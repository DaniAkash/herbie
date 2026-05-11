import type { AcpxProvider } from 'acpx-ai-provider'
import { type LanguageModelUsage, streamText } from 'ai'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { DB } from '../../db'
import { taskRuns } from '../../db/schema/task-runs.sql'
import { buildAcpxProvider } from '../chat/acpxProvider'
import { extractErrorDetails } from '../chat/error-details'
import { SegmentBuffer } from '../chat/streamPart'
import { readAgentCapability } from '../routes/settings'
import { getRunEventBus } from './run-event-bus'
import type { ActiveRunEventCtx } from './run-event-sink'
import { RunEventSink } from './run-event-sink'
import type { PersistedRunEvent, RunFinishReason } from './run-events'
import {
  aggregateAssistantFromEvents,
  extractAssistantTextFromPart,
} from './run-result'

export interface TaskRunTuple {
  agentId: string
  modelId: string | null
  workspacePath: string | null
  reasoningEffort: string | null
}

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
  // Aggregated assistant text from the run — persisted onto task_runs.
  private resultParts: string[] = []

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
    try {
      await this.provider?.close('run disposed')
    } catch {
      // best-effort
    }
    this.provider = null
  }

  private async spinUpProvider(): Promise<void> {
    // sessionKey is unique per run — guarantees `usedKeys` miss on the
    // acpx side so the agent gets `mode: 'fresh'` and never sees prior
    // run state.
    const sessionKey = `__task-run::${this.init.taskId}::${this.runId}`
    const provider = buildAcpxProvider({
      conversationId: this.runId,
      agentId: this.init.tuple.agentId,
      workspacePath: this.init.tuple.workspacePath ?? undefined,
      sessionKey,
    })
    await provider.prepare()
    if (this.init.tuple.modelId) {
      await provider.setConfigOption('model', this.init.tuple.modelId)
    }
    if (this.init.tuple.reasoningEffort) {
      const cap = await readAgentCapability(this.db, this.init.tuple.agentId)
      const reasoningKey = cap?.reasoning?.key
      if (reasoningKey) {
        await provider.setConfigOption(
          reasoningKey,
          this.init.tuple.reasoningEffort,
        )
      }
    }
    this.provider = provider
  }

  private async runStream(): Promise<void> {
    if (!this.provider || !this.controller) return
    let usage: LanguageModelUsage | undefined
    let finishReason: RunFinishReason = 'unknown'
    try {
      const result = streamText({
        model: this.provider.languageModel(),
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
      await this.finalize('completed')
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
    errFields?: {
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
    await this.db
      .update(taskRuns)
      .set({
        status,
        finishedAt: new Date(),
        resultText,
        errorMessage: errFields?.errorMessage ?? null,
        errorCode: errFields?.errorCode ?? null,
        errorDetails: errFields?.errorDetails ?? null,
      })
      .where(eq(taskRuns.id, this.runId))
      .run()
    this.activeTurn = null
  }
}
