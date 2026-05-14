import type { AcpxProvider } from 'acpx-ai-provider'
import { type LanguageModelUsage, type ModelMessage, streamText } from 'ai'
import { desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { DB } from '../../db'
import { chatEvents } from '../../db/schema/chat-events.sql'
import {
  type Conversation,
  conversations,
} from '../../db/schema/conversations.sql'
import {
  persistAcpxIds,
  persistTuple,
  setConversationStatus,
} from './conversation-state'
import { extractErrorDetails } from './error-details'
import { EventSink } from './event-sink'
import { getEventBus } from './eventBus'
import type {
  PersistedEvent,
  ProtocolEvent,
  TurnFinishReason,
} from './events.types'
import { SegmentBuffer } from './streamPart'
import type { ChatTuple } from './tuple'
import { routeTurn, type TurnRouteState } from './turn-router'

export type { ChatTuple }

export class TurnInProgressError extends Error {
  readonly code = 'TURN_IN_PROGRESS' as const
}

interface ActiveTurn {
  requestId: string
  controller: AbortController
  // Holds every event emitted during the turn for mid-turn SSE reconnect.
  buffer: PersistedEvent[]
  textSegments: SegmentBuffer
  reasoningSegments: SegmentBuffer
  provider: AcpxProvider
}

function tupleFromConversation(conv: Conversation): ChatTuple {
  return {
    agentId: conv.agentId,
    modelId: conv.modelId,
    workspacePath: conv.workspacePath,
    reasoningEffort: conv.reasoningEffort,
  }
}

/**
 * Owns one chat conversation's runtime state: the live acpx provider,
 * the in-flight turn, and the event sink. Tuple-change routing
 * (build/dispose provider, replay transcript, in-place config) lives
 * in `routeTurn` (see turn-router.ts) — this class drives turn
 * lifecycle (start/run/cancel/dispose).
 */
export class ChatSession {
  private readonly routeState: TurnRouteState
  private activeTurn: ActiveTurn | null = null
  private readonly seededFromInbox: boolean
  private readonly events: EventSink

  private constructor(
    private conversation: Conversation,
    private readonly db: DB,
    nextSeq: number,
  ) {
    // Inbox-seeded convo (events present + no acpx session yet) —
    // needs its own sessionKey and a forced first-turn replay. For
    // non-seeded convs we seed `activeTuple` from the row so a future
    // pre-built-provider path can take session/load on resume.
    const seededFromInbox = nextSeq > 0 && conversation.acpxRecordId == null
    this.seededFromInbox = seededFromInbox
    this.routeState = {
      provider: null,
      providerBootstrapped: false,
      activeTuple: seededFromInbox ? null : tupleFromConversation(conversation),
    }
    this.events = new EventSink(
      db,
      conversation.id,
      getEventBus(),
      nextSeq,
      () => this.activeTurn,
    )
  }

  static async create(conversationId: string, db: DB): Promise<ChatSession> {
    const conv = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get()
    if (!conv) {
      throw new Error(`conversation not found: ${conversationId}`)
    }

    const last = await db
      .select({ seq: chatEvents.seq })
      .from(chatEvents)
      .where(eq(chatEvents.conversationId, conversationId))
      .orderBy(desc(chatEvents.seq))
      .limit(1)
      .get()

    return new ChatSession(conv, db, (last?.seq ?? -1) + 1)
  }

  get isStreaming(): boolean {
    return this.activeTurn !== null
  }

  // Bridges DB replay → live bus for an SSE subscriber connecting mid-turn.
  getActiveTurnSnapshot(afterSeq: number): PersistedEvent[] {
    return this.activeTurn?.buffer.filter((e) => e.seq > afterSeq) ?? []
  }

  async appendUserMessage(
    text: string,
    tuple: ChatTuple,
  ): Promise<{ requestId: string }> {
    if (this.activeTurn)
      throw new TurnInProgressError('turn already in progress')

    const requestId = nanoid(8)
    const controller = new AbortController()
    await this.setStatus('streaming')
    await this.events.writeProtocolEvent({
      type: 'turn.start',
      payload: {
        requestId,
        userMessage: text,
        agentId: tuple.agentId,
        modelId: tuple.modelId,
        workspacePath: tuple.workspacePath,
        reasoningEffort: tuple.reasoningEffort,
      },
    })

    // routeTurn + the stream start can both throw — agent not
    // installed, acpx rejects a config option, etc. Without a guard
    // here turn.start lives on forever in the event log and the
    // renderer is stuck on "streaming".
    try {
      const messages = await routeTurn(
        {
          db: this.db,
          conversationId: this.conversation.id,
          seededFromInbox: this.seededFromInbox,
          resolverDeps: {
            db: this.db,
            conversationId: this.conversation.id,
            writeProtocolEvent: (e: ProtocolEvent) =>
              this.events.writeProtocolEvent(e),
          },
          state: this.routeState,
        },
        tuple,
        text,
        requestId,
      )
      await this.startTurn(messages, tuple, requestId, controller)
      return { requestId }
    } catch (err) {
      await this.failTurnStart(requestId, err)
      throw err
    }
  }

  private async startTurn(
    messages: ModelMessage[],
    tuple: ChatTuple,
    requestId: string,
    controller: AbortController,
  ): Promise<void> {
    // routeTurn guarantees a live provider before returning.
    const provider = this.routeState.provider as AcpxProvider
    this.activeTurn = {
      requestId,
      controller,
      buffer: [],
      textSegments: new SegmentBuffer(),
      reasoningSegments: new SegmentBuffer(),
      provider,
    }

    const result = streamText({
      model: provider.languageModel(),
      messages,
      abortSignal: controller.signal,
    })

    await this.persistTuple(tuple)

    void this.runTurn(result, requestId, provider)
  }

  private async failTurnStart(requestId: string, err: unknown): Promise<void> {
    const { message, code, details } = extractErrorDetails(err)
    await this.events.writeProtocolEvent({
      type: 'turn.error',
      payload: { requestId, code, message, details },
    })
    await this.setStatus('error')
    this.activeTurn = null
  }

  async cancel(reason?: string): Promise<void> {
    const turn = this.activeTurn
    if (!turn) return
    turn.controller.abort()
    try {
      await turn.provider.cancel(reason)
    } catch {
      // provider.cancel can race with stream completion; non-fatal.
    }
    await this.events.writeProtocolEvent({
      type: 'turn.cancel',
      payload: { requestId: turn.requestId, reason },
    })
    await this.setStatus('cancelled')
    this.activeTurn = null
  }

  async dispose(): Promise<void> {
    if (this.activeTurn) {
      try {
        this.activeTurn.controller.abort()
      } catch {}
    }
    const provider = this.routeState.provider
    this.routeState.provider = null
    this.routeState.providerBootstrapped = false
    if (provider) {
      try {
        await provider.close('session disposed')
      } catch {
        // best-effort
      }
    }
  }

  private async runTurn(
    result: ReturnType<typeof streamText>,
    requestId: string,
    provider: AcpxProvider,
  ): Promise<void> {
    let usage: LanguageModelUsage | undefined
    let finishReason: TurnFinishReason = 'unknown'
    try {
      for await (const part of result.fullStream) {
        await this.events.writeStreamEvent(part)
      }
      finishReason = (await result.finishReason) as TurnFinishReason
      usage = await result.totalUsage
      await this.events.writeProtocolEvent({
        type: 'turn.finish',
        payload: { requestId, finishReason, usage },
      })
      await this.setStatus('idle')
      await this.persistAcpxIds(provider)
    } catch (err) {
      // cancel() already wrote turn.cancel + flipped status, don't double-emit.
      if (this.activeTurn?.requestId !== requestId) return
      const { message, code, details } = extractErrorDetails(err)
      await this.events.writeProtocolEvent({
        type: 'turn.error',
        payload: { requestId, code, message, details },
      })
      await this.setStatus('error')
    } finally {
      if (this.activeTurn?.requestId === requestId) {
        this.activeTurn = null
      }
    }
  }

  private async setStatus(status: Conversation['status']): Promise<void> {
    this.conversation = await setConversationStatus(
      this.db,
      this.conversation,
      status,
    )
  }

  private async persistTuple(tuple: ChatTuple): Promise<void> {
    this.conversation = await persistTuple(this.db, this.conversation, tuple)
  }

  private async persistAcpxIds(provider: AcpxProvider): Promise<void> {
    try {
      this.conversation = await persistAcpxIds(
        this.db,
        this.conversation,
        provider,
      )
    } catch {
      // Non-fatal: next turn will start a fresh ACP session under the same key.
    }
  }
}
