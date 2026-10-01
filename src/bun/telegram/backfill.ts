import { and, asc, eq, isNull } from 'drizzle-orm'
import { conversations } from '../../db/schema/conversations.sql'
import type { TelegramConnection } from '../../db/schema/telegram-connections.sql'
import { telegramTopics } from '../../db/schema/telegram-topics.sql'
import { getDb } from '../db-singleton'
import { TelegramApiError } from './api'
import { ensureTopicForConversation } from './topics'

// Telegram allows roughly 20 topic operations a minute per chat, and
// punishes a burst by suspending the bot's send rights for several
// minutes. 3.5s between creations keeps a comfortable margin, and the
// backfill is background work so the wall-clock cost does not matter.
const CREATE_INTERVAL_MS = 3_500

// A ceiling exists per chat (1,000 topics). Stopping short of it leaves
// the user room to keep working while they decide what to delete;
// deleting is what actually reclaims quota, since archiving only
// closes.
const TOPIC_BUDGET = 900

// Keyed by connection: two connections are independent, and a shared
// flag meant a long backfill on one silently skipped the other.
const running = new Set<string>()

/**
 * Gives every conversation that lacks one a topic.
 *
 * Deliberately sequential and slow. Runs at most once at a time, so a
 * second trigger while one is in flight is a no-op rather than a
 * parallel burst against the same rate limit.
 */
export async function backfillTopics(
  connection: TelegramConnection,
): Promise<{ created: number; skipped: number }> {
  if (running.has(connection.id)) return { created: 0, skipped: 0 }
  if (!connection.topicsEnabled || !connection.dmChatId) {
    return { created: 0, skipped: 0 }
  }

  running.add(connection.id)
  try {
    const db = getDb()
    const existing = await db
      .select({ conversationId: telegramTopics.conversationId })
      .from(telegramTopics)
      .where(eq(telegramTopics.connectionId, connection.id))
      .all()
    const have = new Set(existing.map((r) => r.conversationId))

    const pending = (
      await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(isNull(conversations.archivedAt))
        .orderBy(asc(conversations.updatedAt))
        .all()
    ).filter((c) => !have.has(c.id))

    const budget = Math.max(0, TOPIC_BUDGET - have.size)
    const batch = pending.slice(0, budget)

    let created = 0
    for (const [index, conv] of batch.entries()) {
      if (index > 0) await sleep(CREATE_INTERVAL_MS)
      const topic = await ensureTopicForConversation(db, connection, conv.id)
      if (topic) created++
    }

    const skipped = pending.length - batch.length
    if (skipped > 0) {
      // biome-ignore lint/suspicious/noConsole: the alternative is silently omitting conversations
      console.warn(
        `[telegram:backfill] ${skipped} conversation(s) left without a topic: ` +
          `${have.size + created} of ${TOPIC_BUDGET} budget used`,
      )
    }
    return { created, skipped }
  } finally {
    running.delete(connection.id)
  }
}

/** Seconds Telegram asked us to wait, when it said so. */
export function retryAfterMs(err: unknown): number | null {
  if (!(err instanceof TelegramApiError)) return null
  return err.retryAfter === undefined ? null : err.retryAfter * 1000
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Conversations that ought to have a topic but do not yet. */
export async function countMissingTopics(): Promise<number> {
  const db = getDb()
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .leftJoin(
      telegramTopics,
      eq(telegramTopics.conversationId, conversations.id),
    )
    .where(
      and(
        isNull(conversations.archivedAt),
        isNull(telegramTopics.conversationId),
      ),
    )
    .all()
  return rows.length
}
