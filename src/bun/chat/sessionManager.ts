import { getDb } from '../db-singleton'
import { ChatSession } from './ChatSession'

export interface SessionManager {
  getOrCreate(conversationId: string): Promise<ChatSession>
  get(conversationId: string): ChatSession | undefined
  dispose(conversationId: string): Promise<void>
  disposeAll(): Promise<void>
}

class SessionManagerImpl implements SessionManager {
  private readonly sessions = new Map<string, ChatSession>()
  private readonly inflight = new Map<string, Promise<ChatSession>>()

  async getOrCreate(conversationId: string): Promise<ChatSession> {
    const existing = this.sessions.get(conversationId)
    if (existing) return existing
    const pending = this.inflight.get(conversationId)
    if (pending) return pending

    const promise = ChatSession.create(conversationId, getDb()).then(
      (session) => {
        this.sessions.set(conversationId, session)
        this.inflight.delete(conversationId)
        return session
      },
      (err) => {
        this.inflight.delete(conversationId)
        throw err
      },
    )
    this.inflight.set(conversationId, promise)
    return promise
  }

  get(conversationId: string): ChatSession | undefined {
    return this.sessions.get(conversationId)
  }

  async dispose(conversationId: string): Promise<void> {
    const session = this.sessions.get(conversationId)
    if (!session) return
    this.sessions.delete(conversationId)
    await session.dispose()
  }

  async disposeAll(): Promise<void> {
    const all = [...this.sessions.values()]
    this.sessions.clear()
    await Promise.allSettled(all.map((s) => s.dispose()))
  }
}

let instance: SessionManager | null = null

export function getSessionManager(): SessionManager {
  if (!instance) instance = new SessionManagerImpl()
  return instance
}
