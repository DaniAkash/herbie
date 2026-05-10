import type { DB } from '../../db'
import { chatEvents } from '../../db/schema/chat-events.sql'
import type { EventBus } from './eventBus'
import {
  EPHEMERAL_STREAM_SUBTYPES,
  type PersistedEvent,
  type ProtocolEvent,
  STREAM_SUBTYPE_RENAMES,
} from './events.types'
import {
  coalesceStreamPart,
  extractStreamSubtype,
  type SegmentBuffer,
} from './streamPart'

export interface ActiveTurnEventCtx {
  buffer: PersistedEvent[]
  textSegments: SegmentBuffer
  reasoningSegments: SegmentBuffer
  requestId: string
}

// Holds the running per-conversation seq counter + bus reference so the
// streaming helpers don't need it threaded through every call. The seq
// state lives on the sink so a single ChatSession instance owns the
// monotonic ordering for its conversation.
export class EventSink {
  constructor(
    private readonly db: DB,
    private readonly conversationId: string,
    private readonly bus: EventBus,
    private nextSeq: number,
    private getActiveTurn: () => ActiveTurnEventCtx | null,
  ) {}

  async writeProtocolEvent(event: ProtocolEvent): Promise<void> {
    await this.writeEvent(event.type, event.payload)
  }

  async writeStreamEvent(part: unknown): Promise<void> {
    const subtype = extractStreamSubtype(part)
    const turn = this.getActiveTurn()
    if (turn) {
      const coalesced = coalesceStreamPart(
        subtype,
        part,
        { text: turn.textSegments, reasoning: turn.reasoningSegments },
        turn.requestId,
      )
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
      conversationId: this.conversationId,
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
      .insert(chatEvents)
      .values({
        conversationId: this.conversationId,
        seq,
        type,
        payload: JSON.stringify(payload),
        createdAt,
      })
      .run()
    this.deliver({
      conversationId: this.conversationId,
      seq,
      type,
      payload,
      createdAt,
    })
  }

  // Buffer captures every event emitted during the turn so a mid-turn
  // SSE subscriber sees the in-flight UI on reconnect.
  private deliver(event: PersistedEvent): void {
    const turn = this.getActiveTurn()
    if (turn) turn.buffer.push(event)
    this.bus.emit(this.conversationId, event)
  }
}
