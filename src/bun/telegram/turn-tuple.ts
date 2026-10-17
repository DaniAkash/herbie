import type { Conversation } from '../../db/schema/conversations.sql'
import type { ChatTuple } from '../chat/tuple'

/**
 * The tuple a Telegram-driven turn runs under: always the
 * conversation's own.
 *
 * A bot's configured agent, model, workspace and effort are defaults,
 * stamped onto conversations the bot creates, never an override for a
 * conversation that already exists. Running a turn under the bot's
 * tuple instead would differ in agentId or workspacePath for any
 * conversation started elsewhere, which fails providerKeyEqual and
 * sends the turn down the rebuild path: the open provider is closed
 * and the transcript is replayed into a different agent in a
 * different directory.
 */
export function conversationTurnTuple(conv: Conversation): ChatTuple {
  return {
    agentId: conv.agentId,
    modelId: conv.modelId,
    workspacePath: conv.workspacePath,
    reasoningEffort: conv.reasoningEffort,
  }
}
