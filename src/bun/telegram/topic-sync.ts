import { eq } from 'drizzle-orm'
import {
  type TelegramConnection,
  telegramConnections,
} from '../../db/schema/telegram-connections.sql'
import { telegramTopics } from '../../db/schema/telegram-topics.sql'
import { getDb } from '../db-singleton'
import { decryptSecret } from '../security/secrets'
import {
  closeForumTopic,
  deleteForumTopic,
  editForumTopic,
  reopenForumTopic,
  truncateTopicName,
} from './api'
import { findTopicByConversation, markTopicError } from './topics'

// Desktop-side lifecycle changes pushed out to the matching topic.
//
// Every entry point is fire-and-forget: a rename or an archive is a
// local action that has already succeeded by the time we get here, so
// a Telegram failure must not fail it. Failures land on the topic row
// as syncState 'error' where the sidebar can show them.

interface ResolvedTopic {
  connection: TelegramConnection
  token: string
  chatId: string
  messageThreadId: number
  topicTitle: string | null
}

// Returns null rather than throwing: callers invoke these with `void`,
// so a decrypt or database failure here would surface as an unhandled
// rejection instead of the sidebar's error state.
async function resolveTopic(
  conversationId: string,
): Promise<ResolvedTopic | null> {
  try {
    return await readTopic(conversationId)
  } catch (err) {
    await markTopicError(getDb(), conversationId, err).catch(() => {})
    return null
  }
}

async function readTopic(
  conversationId: string,
): Promise<ResolvedTopic | null> {
  const db = getDb()
  const topic = await findTopicByConversation(db, conversationId)
  if (!topic || topic.messageThreadId === null) return null

  const connection = await db
    .select()
    .from(telegramConnections)
    .where(eq(telegramConnections.id, topic.connectionId))
    .get()
  if (!connection || connection.status !== 'active') return null

  return {
    connection,
    token: await decryptSecret(connection.botTokenEncrypted),
    chatId: topic.telegramChatId,
    messageThreadId: topic.messageThreadId,
    topicTitle: topic.topicTitle,
  }
}

export async function syncTopicTitle(
  conversationId: string,
  title: string,
): Promise<void> {
  const resolved = await resolveTopic(conversationId)
  if (!resolved) return

  // Telegram truncates nothing for us and rejects over-long names, so
  // compare what would actually be sent rather than the raw title.
  // Without this every unrelated PATCH would spend a rename call.
  const next = truncateTopicName(title)
  if (next === resolved.topicTitle) return

  try {
    await editForumTopic(
      resolved.token,
      resolved.chatId,
      resolved.messageThreadId,
      next,
    )
    await getDb()
      .update(telegramTopics)
      .set({ topicTitle: next, updatedAt: new Date() })
      .where(eq(telegramTopics.conversationId, conversationId))
      .run()
  } catch (err) {
    await markTopicError(getDb(), conversationId, err)
  }
}

export async function syncTopicArchived(
  conversationId: string,
  archived: boolean,
): Promise<void> {
  const resolved = await resolveTopic(conversationId)
  if (!resolved) return

  try {
    if (archived) {
      await closeForumTopic(
        resolved.token,
        resolved.chatId,
        resolved.messageThreadId,
      )
    } else {
      await reopenForumTopic(
        resolved.token,
        resolved.chatId,
        resolved.messageThreadId,
      )
    }
    await getDb()
      .update(telegramTopics)
      .set({
        syncState: archived ? 'closed' : 'live',
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(telegramTopics.conversationId, conversationId))
      .run()
  } catch (err) {
    await markTopicError(getDb(), conversationId, err)
  }
}

/**
 * Captures what is needed to remove a conversation's topic.
 *
 * The topic row cascades away with the conversation, taking the thread
 * id with it, so this has to run first. It deliberately does no
 * network work: the caller is serving a user's delete and should not
 * wait on Telegram to answer.
 */
export async function captureTopicForDeletion(
  conversationId: string,
): Promise<ResolvedTopic | null> {
  return await resolveTopic(conversationId)
}

/**
 * Removes a topic whose conversation has been deleted.
 *
 * Deleting is the only operation that destroys Telegram-side history,
 * which is why archiving closes instead, and the only one that returns
 * quota against the per-chat topic ceiling. A failure here leaves an
 * orphaned topic that no longer has a row to record the error against,
 * so it is logged rather than swallowed.
 */
export async function syncTopicDeleted(
  captured: ResolvedTopic | null,
): Promise<void> {
  if (!captured) return
  try {
    await deleteForumTopic(
      captured.token,
      captured.chatId,
      captured.messageThreadId,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // biome-ignore lint/suspicious/noConsole: the conversation is gone, so there is no row left to surface this on
    console.error(
      `[telegram:topic-sync] topic ${captured.messageThreadId} in chat ${captured.chatId} ` +
        `was left behind and still holds a topic slot: ${message}`,
    )
  }
}
