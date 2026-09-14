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

async function resolveTopic(
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
 * Removes the topic for a conversation being deleted.
 *
 * Deleting is the only operation that destroys Telegram-side history,
 * which is why archiving closes instead. It is also the only one that
 * returns quota against the per-chat topic ceiling.
 *
 * Must be called before the conversation row goes, since the topic row
 * cascades away with it and takes the thread id needed to make the
 * call.
 */
export async function syncTopicDeleted(conversationId: string): Promise<void> {
  const resolved = await resolveTopic(conversationId)
  if (!resolved) return
  try {
    await deleteForumTopic(
      resolved.token,
      resolved.chatId,
      resolved.messageThreadId,
    )
  } catch {
    // The conversation is going away regardless. A leftover topic is
    // untidy; blocking the delete on Telegram would be worse.
  }
}
