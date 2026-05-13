import { randomBytes } from 'node:crypto'
import type { Lock, QueueEntry, StateAdapter } from 'chat'

// In-memory StateAdapter for chat-sdk. Holds bot operational state
// only — subscriptions, locks, dedupe key/value, message queues. The
// real chat history lives in our chat_events table; we never lean on
// chat-sdk to persist anything across process restarts.
//
// One instance per Chat (i.e. per Telegram connection). When a
// connection restarts, a fresh adapter is created — that's fine
// because the bot state we'd lose (in-flight locks, recently-deduped
// updates) is bounded by polling intervals.
type Entry = { value: unknown; expiresAt: number | null }

export class MemoryStateAdapter implements StateAdapter {
  private readonly kv = new Map<string, Entry>()
  private readonly lists = new Map<string, unknown[]>()
  private readonly subs = new Set<string>()
  private readonly locks = new Map<string, Lock>()
  private readonly queues = new Map<string, QueueEntry[]>()

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {
    this.kv.clear()
    this.lists.clear()
    this.subs.clear()
    this.locks.clear()
    this.queues.clear()
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.kv.get(key)
    if (!entry) return null
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.kv.delete(key)
      return null
    }
    return entry.value as T
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.kv.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    })
  }

  async setIfNotExists(
    key: string,
    value: unknown,
    ttlMs?: number,
  ): Promise<boolean> {
    const existing = this.kv.get(key)
    if (existing) {
      if (existing.expiresAt === null || existing.expiresAt >= Date.now()) {
        return false
      }
    }
    await this.set(key, value, ttlMs)
    return true
  }

  async delete(key: string): Promise<void> {
    this.kv.delete(key)
  }

  async appendToList(
    key: string,
    value: unknown,
    options?: { maxLength?: number; ttlMs?: number },
  ): Promise<void> {
    const list = this.lists.get(key) ?? []
    list.push(value)
    if (options?.maxLength && list.length > options.maxLength) {
      list.splice(0, list.length - options.maxLength)
    }
    this.lists.set(key, list)
  }

  async getList<T = unknown>(key: string): Promise<T[]> {
    return [...((this.lists.get(key) ?? []) as T[])]
  }

  async subscribe(threadId: string): Promise<void> {
    this.subs.add(threadId)
  }

  async unsubscribe(threadId: string): Promise<void> {
    this.subs.delete(threadId)
  }

  async isSubscribed(threadId: string): Promise<boolean> {
    return this.subs.has(threadId)
  }

  async acquireLock(threadId: string, ttlMs: number): Promise<Lock | null> {
    const existing = this.locks.get(threadId)
    if (existing && existing.expiresAt > Date.now()) return null
    const lock: Lock = {
      threadId,
      token: randomBytes(12).toString('hex'),
      expiresAt: Date.now() + ttlMs,
    }
    this.locks.set(threadId, lock)
    return lock
  }

  async extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    const current = this.locks.get(lock.threadId)
    if (!current || current.token !== lock.token) return false
    current.expiresAt = Date.now() + ttlMs
    this.locks.set(lock.threadId, current)
    return true
  }

  async releaseLock(lock: Lock): Promise<void> {
    const current = this.locks.get(lock.threadId)
    if (current && current.token === lock.token) {
      this.locks.delete(lock.threadId)
    }
  }

  async forceReleaseLock(threadId: string): Promise<void> {
    this.locks.delete(threadId)
  }

  async enqueue(
    threadId: string,
    entry: QueueEntry,
    maxSize: number,
  ): Promise<number> {
    const queue = this.queues.get(threadId) ?? []
    queue.push(entry)
    if (queue.length > maxSize) queue.splice(0, queue.length - maxSize)
    this.queues.set(threadId, queue)
    return queue.length
  }

  async dequeue(threadId: string): Promise<QueueEntry | null> {
    const queue = this.queues.get(threadId)
    if (!queue || queue.length === 0) return null
    const next = queue.shift()
    if (queue.length === 0) this.queues.delete(threadId)
    return next ?? null
  }

  async queueDepth(threadId: string): Promise<number> {
    return this.queues.get(threadId)?.length ?? 0
  }
}
