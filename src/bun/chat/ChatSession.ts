import type { AcpxProvider } from 'acpx-ai-provider'
import { type LanguageModelUsage, streamText } from 'ai'
import { desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { DB } from '../../db'
import { chatEvents } from '../../db/schema/chat-events.sql'
import {
  type Conversation,
  conversations,
} from '../../db/schema/conversations.sql'
import { buildAcpxProvider } from './acpxProvider'
import { getEventBus } from './eventBus'
import type {
  PersistedEvent,
  ProtocolEvent,
  TurnFinishReason,
} from './events.types'

export class TurnInProgressError extends Error {
  readonly code = 'TURN_IN_PROGRESS' as const
}

interface ActiveTurn {
  requestId: string
  controller: AbortController
}

export class ChatSession {
  private provider: AcpxProvider | null = null
  private nextSeq: number
  private activeTurn: ActiveTurn | null = null
  private readonly bus = getEventBus()

  private constructor(
    private conversation: Conversation,
    private readonly db: DB,
    nextSeq: number,
  ) {
    this.nextSeq = nextSeq
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

  async appendUserMessage(text: string): Promise<{ requestId: string }> {
    if (this.activeTurn)
      throw new TurnInProgressError('turn already in progress')

    const requestId = nanoid(8)
    const controller = new AbortController()
    this.activeTurn = { requestId, controller }
    await this.setStatus('streaming')
    await this.writeProtocolEvent({
      type: 'turn.start',
      payload: { requestId, userMessage: text },
    })

    const provider = this.ensureProvider()
    const result = streamText({
      model: provider.languageModel(),
      messages: [{ role: 'user', content: text }],
      abortSignal: controller.signal,
    })

    void this.runTurn(result, requestId, provider)

    return { requestId }
  }

  async cancel(reason?: string): Promise<void> {
    const turn = this.activeTurn
    if (!turn) return
    turn.controller.abort()
    try {
      await this.provider?.cancel(reason)
    } catch {
      // provider.cancel can race with stream completion; non-fatal.
    }
    await this.writeProtocolEvent({
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
    try {
      await this.provider?.close('session disposed')
    } catch {}
    this.provider = null
  }

  private ensureProvider(): AcpxProvider {
    if (this.provider) return this.provider
    this.provider = buildAcpxProvider({
      conversationId: this.conversation.id,
      agentId: this.conversation.agentId,
      cwd: this.conversation.workspaceId,
      resumeSessionId: this.conversation.acpxSessionId,
    })
    return this.provider
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
        await this.writeStreamEvent(part)
      }
      finishReason = (await result.finishReason) as TurnFinishReason
      usage = await result.totalUsage
      await this.writeProtocolEvent({
        type: 'turn.finish',
        payload: { requestId, finishReason, usage },
      })
      await this.setStatus('idle')
      await this.persistAcpxIds(provider)
    } catch (err) {
      // The abort path lands here when cancel() ran; cancel already wrote
      // turn.cancel + flipped status, so don't double-emit.
      if (this.activeTurn?.requestId !== requestId) return
      const message = err instanceof Error ? err.message : String(err)
      const code = err instanceof Error ? err.name : undefined
      await this.writeProtocolEvent({
        type: 'turn.error',
        payload: { requestId, code, message },
      })
      await this.setStatus('error')
    } finally {
      if (this.activeTurn?.requestId === requestId) {
        this.activeTurn = null
      }
    }
  }

  private async writeProtocolEvent(event: ProtocolEvent): Promise<void> {
    await this.writeEvent(event.type, event.payload)
  }

  private async writeStreamEvent(part: unknown): Promise<void> {
    const type =
      typeof part === 'object' &&
      part !== null &&
      'type' in part &&
      typeof (part as { type: unknown }).type === 'string'
        ? `stream.${(part as { type: string }).type}`
        : 'stream.unknown'
    await this.writeEvent(type, part)
  }

  private async writeEvent(type: string, payload: unknown): Promise<void> {
    const seq = this.nextSeq++
    const createdAt = new Date()
    await this.db
      .insert(chatEvents)
      .values({
        conversationId: this.conversation.id,
        seq,
        type,
        payload: JSON.stringify(payload),
        createdAt,
      })
      .run()
    const persisted: PersistedEvent = {
      conversationId: this.conversation.id,
      seq,
      type,
      payload,
      createdAt,
    }
    this.bus.emit(this.conversation.id, persisted)
  }

  private async setStatus(status: Conversation['status']): Promise<void> {
    const updatedAt = new Date()
    await this.db
      .update(conversations)
      .set({ status, updatedAt })
      .where(eq(conversations.id, this.conversation.id))
      .run()
    this.conversation = { ...this.conversation, status, updatedAt }
  }

  private async persistAcpxIds(provider: AcpxProvider): Promise<void> {
    try {
      const { handle } = await provider.ensureHandle()
      const status = await provider.runtime.getStatus?.({ handle })
      const next = {
        acpxSessionId: handle.runtimeSessionName ?? null,
        acpxRecordId: status?.acpxRecordId ?? handle.acpxRecordId ?? null,
        agentSessionId: status?.agentSessionId ?? handle.agentSessionId ?? null,
      }
      await this.db
        .update(conversations)
        .set({ ...next, updatedAt: new Date() })
        .where(eq(conversations.id, this.conversation.id))
        .run()
      this.conversation = { ...this.conversation, ...next }
    } catch {
      // Resume metadata is a nice-to-have; failure here is non-fatal — the
      // next turn just starts a fresh ACP session under the same key.
    }
  }
}
