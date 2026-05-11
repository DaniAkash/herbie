import type { AcpxProvider } from 'acpx-ai-provider'
import { type LanguageModelUsage, streamText } from 'ai'
import { nanoid } from 'nanoid'
import type { DB } from '../../db'
import { taskRuns } from '../../db/schema/task-runs.sql'
import { extractErrorDetails } from '../chat/error-details'
import { SegmentBuffer } from '../chat/streamPart'
import { getRunEventBus } from './run-event-bus'
import type { ActiveRunEventCtx } from './run-event-sink'
import { RunEventSink } from './run-event-sink'
import type { PersistedRunEvent, RunFinishReason } from './run-events'
import {
  aggregateAssistantFromEvents,
  extractAssistantTextFromPart,
  pickOutputSource,
  writeFinalRow,
} from './run-result'
import { SCHEDULED_RUN_SYSTEM_PROMPT } from './run-system-prompt'
import type { RegisteredCapture } from './task-result-capture'
import { spinUpTaskRunProvider, type TaskRunTuple } from './task-run-provider'

// Re-exported so callers (runManager, etc.) don't need to know the
// tuple lives next door.
export type { TaskRunTuple } from './task-run-provider'

export interface TaskRunInit {
  taskId: string
  promptSnapshot: string
  tuple: TaskRunTuple
  trigger: 'scheduled' | 'test'
}

// Single-turn ACP run with a fresh sessionKey so the agent has no
// memory of prior runs (statelessness guarantee per the plan). The
// lifecycle:
//   1. row inserted in task_runs (status='running')
//   2. provider built with a unique sessionKey, prepare() + setConfig
//   3. streamText with the prompt; deltas → SSE via run-event-sink
//   4. on success: aggregate resultText, mark status='completed', emit
//      turn.finish
//   5. on cancel/error: emit terminal event, set status, dispose
//   6. dispose closes the provider so no state leaks to a future run
export class TaskRunSession {
  private readonly runId: string
  private readonly requestId: string
  private readonly events: RunEventSink
  private provider: AcpxProvider | null = null
  private controller: AbortController | null = null
  private activeTurn: ActiveRunEventCtx | null = null
  // Aggregated assistant text from the run — persisted onto task_runs
  // as the legacy fallback when the agent doesn't call the
  // herbie__task_result MCP tool.
  private resultParts: string[] = []
  // Per-run capture channel for the herbie__task_result tool.
  // Registered in spinUpProvider, awaited (with a grace window) after
  // streamText resolves in runStream, disposed in dispose/cancel so
  // late POSTs are rejected and any awaiter resolves to null.
  private capture: RegisteredCapture | null = null
  // Resolves after finalize() writes the row — the scheduler awaits
  // this before reading task_runs to deliver the inbox card. The
  // turn.finish bus emit happens before the row update, so a
  // bus-based wait sees an empty resultText.
  public readonly done: Promise<void>
  private resolveDone: () => void = () => {}

  private constructor(
    private readonly db: DB,
    private readonly init: TaskRunInit,
    runId: string,
  ) {
    this.runId = runId
    this.requestId = nanoid(8)
    this.events = new RunEventSink(
      db,
      runId,
      getRunEventBus(),
      0,
      () => this.activeTurn,
    )
    this.done = new Promise<void>((resolve) => {
      this.resolveDone = resolve
    })
  }

  static async create(db: DB, init: TaskRunInit): Promise<TaskRunSession> {
    const runId = nanoid()
    const startedAt = new Date()
    await db
      .insert(taskRuns)
      .values({
        id: runId,
        taskId: init.taskId,
        promptSnapshot: init.promptSnapshot,
        agentId: init.tuple.agentId,
        modelId: init.tuple.modelId,
        workspacePath: init.tuple.workspacePath,
        reasoningEffort: init.tuple.reasoningEffort,
        trigger: init.trigger,
        status: 'running',
        startedAt,
      })
      .run()
    return new TaskRunSession(db, init, runId)
  }

  get id(): string {
    return this.runId
  }

  get isStreaming(): boolean {
    return this.activeTurn !== null
  }

  // Bridges DB replay → live bus for an SSE subscriber connecting
  // mid-run. Matches the chat-side helper of the same name.
  getActiveTurnSnapshot(afterSeq: number): PersistedRunEvent[] {
    return this.activeTurn?.buffer.filter((e) => e.seq > afterSeq) ?? []
  }

  // Kicks off the run. Resolves with the runId immediately; the actual
  // streaming happens in the background and lands on the SSE bus.
  async start(): Promise<{ runId: string }> {
    this.controller = new AbortController()
    this.activeTurn = {
      buffer: [],
      textSegments: new SegmentBuffer(),
      reasoningSegments: new SegmentBuffer(),
      requestId: this.requestId,
    }
    await this.events.writeProtocolEvent({
      type: 'turn.start',
      payload: {
        requestId: this.requestId,
        userMessage: this.init.promptSnapshot,
      },
    })

    try {
      await this.spinUpProvider()
    } catch (err) {
      await this.failBeforeStream(err)
      throw err
    }

    void this.runStream()
    return { runId: this.runId }
  }

  async cancel(reason?: string): Promise<void> {
    if (!this.activeTurn) return
    // Clear activeTurn synchronously *before* we yield to the
    // event loop. controller.abort() makes runStream's `for await`
    // throw on the next tick; its catch checks `if (!this.activeTurn)
    // return` to skip emitting a competing turn.error + finalize.
    // If we left activeTurn populated until finalize() at the end of
    // this method, the catch would race past that guard and we'd
    // double-finalize (turn.cancel + turn.error, status flipped twice).
    this.activeTurn = null
    this.controller?.abort()
    try {
      await this.provider?.cancel(reason)
    } catch {
      // racing with stream completion is non-fatal
    }
    await this.events.writeProtocolEvent({
      type: 'turn.cancel',
      payload: { requestId: this.requestId, reason },
    })
    await this.finalize('cancelled')
  }

  async dispose(): Promise<void> {
    this.activeTurn = null
    // Release the capture before tearing down the provider — if the
    // MCP child is still mid-POST when stdio closes, the route's
    // receive() will 404 and the child surfaces a tool error to the
    // agent (which is already going away). Either way the capture
    // promise resolves to null and any await unblocks.
    this.capture?.dispose()
    this.capture = null
    try {
      await this.provider?.close('run disposed')
    } catch {
      // best-effort
    }
    this.provider = null
  }

  private async spinUpProvider(): Promise<void> {
    const { provider, capture } = await spinUpTaskRunProvider(this.db, {
      taskId: this.init.taskId,
      runId: this.runId,
      tuple: this.init.tuple,
    })
    this.provider = provider
    this.capture = capture
  }

  private async runStream(): Promise<void> {
    if (!this.provider || !this.controller) return
    let usage: LanguageModelUsage | undefined
    let finishReason: RunFinishReason = 'unknown'
    try {
      const result = streamText({
        model: this.provider.languageModel(),
        system: SCHEDULED_RUN_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: this.init.promptSnapshot }],
        abortSignal: this.controller.signal,
      })
      for await (const part of result.fullStream) {
        await this.events.writeStreamEvent(part)
        this.captureAssistantText(part)
      }
      finishReason = (await result.finishReason) as RunFinishReason
      usage = await result.totalUsage
      await this.events.writeProtocolEvent({
        type: 'turn.finish',
        payload: { requestId: this.requestId, finishReason, usage },
      })
      // Grace window for the MCP POST: the tool's HTTP request may
      // arrive at Herbie a beat after streamText's `finish` part
      // lands. Cap the wait so a stuck agent doesn't hold the row
      // open forever — null means the tool wasn't called and we
      // fall back to aggregated text in finalize().
      const markdown = await Promise.race([
        this.capture?.promise ?? Promise.resolve<string | null>(null),
        new Promise<string | null>((r) => setTimeout(() => r(null), 2000)),
      ])
      await this.finalize('completed', { resultMarkdown: markdown })
    } catch (err) {
      if (!this.activeTurn) return // cancel() already finalized
      const { message, code, details } = extractErrorDetails(err)
      await this.events.writeProtocolEvent({
        type: 'turn.error',
        payload: { requestId: this.requestId, code, message, details },
      })
      await this.finalize('error', {
        errorMessage: message,
        errorCode: code,
        errorDetails: details,
      })
    } finally {
      await this.dispose()
    }
  }

  private captureAssistantText(part: unknown): void {
    const text = extractAssistantTextFromPart(part)
    if (text) this.resultParts.push(text)
  }

  private async failBeforeStream(err: unknown): Promise<void> {
    const { message, code, details } = extractErrorDetails(err)
    await this.events.writeProtocolEvent({
      type: 'turn.error',
      payload: { requestId: this.requestId, code, message, details },
    })
    await this.finalize('error', {
      errorMessage: message,
      errorCode: code,
      errorDetails: details,
    })
    await this.dispose()
  }

  private async finalize(
    status: 'completed' | 'cancelled' | 'error',
    fields?: {
      // Captured from the herbie__task_result MCP tool, when the
      // agent called it. Null = tool wasn't called / was disposed /
      // returned empty — caller falls back to aggregated text.
      resultMarkdown?: string | null
      errorMessage?: string
      errorCode?: string
      errorDetails?: string
    },
  ): Promise<void> {
    const resultText =
      status === 'completed'
        ? this.resultParts.join('').trim() ||
          (await aggregateAssistantFromEvents(this.db, this.runId))
        : null
    const markdown = fields?.resultMarkdown?.trim() || null
    await writeFinalRow(this.db, this.runId, {
      status,
      resultText,
      resultMarkdown: markdown,
      outputSource: pickOutputSource(markdown, resultText),
      errorMessage: fields?.errorMessage ?? null,
      errorCode: fields?.errorCode ?? null,
      errorDetails: fields?.errorDetails ?? null,
    })
    this.activeTurn = null
    this.resolveDone()
  }
}
