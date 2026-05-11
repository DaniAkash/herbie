import type { DB } from '../../db'
import { taskRunEvents } from '../../db/schema/task-run-events.sql'
import {
  coalesceStreamPart,
  extractStreamSubtype,
  type SegmentBuffer,
} from '../chat/streamPart'
import type { RunEventBus } from './run-event-bus'
import {
  EPHEMERAL_STREAM_SUBTYPES,
  type PersistedRunEvent,
  type RunProtocolEvent,
  STREAM_SUBTYPE_RENAMES,
} from './run-events'

export interface ActiveRunEventCtx {
  buffer: PersistedRunEvent[]
  textSegments: SegmentBuffer
  reasoningSegments: SegmentBuffer
  requestId: string
}

// Mirrors chat/event-sink.ts but writes to task_run_events and emits
// to the run-event-bus. Reuses streamPart helpers — the AI SDK part
// shape is the same for both pipelines, and the coalescer produces a
// ProtocolEvent that we narrow to RunProtocolEvent (identical inner
// shape) before persisting.
export class RunEventSink {
  constructor(
    private readonly db: DB,
    private readonly runId: string,
    private readonly bus: RunEventBus,
    private nextSeq: number,
    private getActiveTurn: () => ActiveRunEventCtx | null,
  ) {}

  async writeProtocolEvent(event: RunProtocolEvent): Promise<void> {
    await this.writeEvent(event.type, event.payload)
  }

  async writeStreamEvent(part: unknown): Promise<void> {
    const subtype = extractStreamSubtype(part)
    const turn = this.getActiveTurn()
    if (turn) {
      // coalesceStreamPart returns chat's ProtocolEvent shape but the
      // four cases it emits (assistant.text / reasoning.complete) are
      // structurally identical to RunProtocolEvent's, so the cast is
      // safe. Keeping the shared helper means there's one place to
      // touch when adding new coalesced events.
      const coalesced = coalesceStreamPart(
        subtype,
        part,
        { text: turn.textSegments, reasoning: turn.reasoningSegments },
        turn.requestId,
      ) as RunProtocolEvent | null
      if (coalesced) await this.writeProtocolEvent(coalesced)
    }

    const type = STREAM_SUBTYPE_RENAMES.get(subtype) ?? `stream.${subtype}`
    if (EPHEMERAL_STREAM_SUBTYPES.has(subtype)) {
      this.emitTransient(type, part)
      return
    }
    await this.writeEvent(type, part)
  }

  private emitTransient(type: string, payload: unknown): void {
    this.deliver({
      runId: this.runId,
      seq: this.nextSeq++,
      type,
      payload,
      createdAt: new Date(),
    })
  }

  private async writeEvent(type: string, payload: unknown): Promise<void> {
    const seq = this.nextSeq++
    const createdAt = new Date()
    await this.db
      .insert(taskRunEvents)
      .values({
        runId: this.runId,
        seq,
        type,
        payload: JSON.stringify(payload),
        createdAt,
      })
      .run()
    this.deliver({
      runId: this.runId,
      seq,
      type,
      payload,
      createdAt,
    })
  }

  private deliver(event: PersistedRunEvent): void {
    const turn = this.getActiveTurn()
    if (turn) turn.buffer.push(event)
    this.bus.emit(this.runId, event)
  }
}
