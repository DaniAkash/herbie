import type { CardElement } from 'chat'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { telegramApprovals } from '../../db/schema/telegram-approvals.sql'
import { telegramTopics } from '../../db/schema/telegram-topics.sql'
import type { PermissionOutcome } from '../chat/events.types'
import { resolve as resolvePermission } from '../chat/permission-registry'
import { getDb } from '../db-singleton'

// Action ids the buttons carry. Matching chat/workflow's own constants
// keeps the vocabulary consistent, but the flow is Herbie's: the
// SDK's requestApproval needs a public webhook URL to POST clicks to,
// and this app never listens on one.
export const APPROVE_ACTION = 'approve'
export const DENY_ACTION = 'deny'

interface PermissionRequestPayload {
  requestId: string
  // The turn that raised this request, so a card is only forwarded to
  // the thread streaming that turn.
  turnRequestId: string
  toolName: string
  toolKind: string | null
  input?: unknown
}

export function isPermissionRequest(
  type: string,
  payload: unknown,
): payload is PermissionRequestPayload {
  if (type !== 'permission.request') return false
  if (typeof payload !== 'object' || payload === null) return false
  return (
    'requestId' in payload &&
    'turnRequestId' in payload &&
    'toolName' in payload
  )
}

/**
 * Registers a pending approval and builds the card that offers it.
 *
 * The card's buttons carry the row id rather than the conversation and
 * request ids, because Telegram caps callback data at 64 bytes.
 */
export async function buildApprovalCard(
  conversationId: string,
  payload: PermissionRequestPayload,
): Promise<{ card: CardElement; approvalId: string }> {
  const id = nanoid(12)
  await getDb()
    .insert(telegramApprovals)
    .values({
      id,
      conversationId,
      permissionRequestId: payload.requestId,
      toolName: payload.toolName,
      resolvedAt: null,
      outcome: null,
      createdAt: new Date(),
    })
    .run()

  const target = describeTarget(payload.input)
  const card: CardElement = {
    type: 'card',
    title: `${kindLabel(payload.toolKind)} ${payload.toolName}`,
    subtitle: target ?? undefined,
    children: [
      {
        type: 'actions',
        children: [
          { type: 'button', id: APPROVE_ACTION, label: 'Approve', value: id },
          { type: 'button', id: DENY_ACTION, label: 'Deny', value: id },
        ],
      },
    ],
  }
  return { card, approvalId: id }
}

/**
 * Applies a tapped decision to the waiting turn.
 *
 * Returns a line to show the user. A tap that resolves nothing is
 * still worth answering: the card stays on screen after the turn ends,
 * so the honest reply is that the moment has passed rather than
 * silence.
 */
export async function resolveApproval(
  approvalId: string,
  action: string,
  threadId: string,
): Promise<string> {
  const db = getDb()

  // A card can be forwarded, and a button copied into another topic.
  // Only a tap from the thread that owns the conversation may decide
  // it, otherwise a stray card could approve work elsewhere while the
  // acknowledgement appears somewhere unrelated.
  const owner = await findTopicByConversationForApproval(db, approvalId)
  if (owner && owner !== threadIdentity(threadId)) {
    return 'That request belongs to a different conversation.'
  }
  const outcome: PermissionOutcome =
    action === APPROVE_ACTION ? 'allow_once' : 'reject_once'

  // Claim the row first, and only act if this call is the one that
  // claimed it. Two taps can otherwise both read it as open, and the
  // loser would overwrite the recorded outcome with the opposite
  // decision to the one actually applied.
  const claimed = await db
    .update(telegramApprovals)
    .set({ resolvedAt: new Date(), outcome })
    .where(
      and(
        eq(telegramApprovals.id, approvalId),
        isNull(telegramApprovals.resolvedAt),
      ),
    )
    .returning()
    .get()
  if (!claimed) return 'That request was already answered.'

  const row = claimed
  const applied = resolvePermission(
    row.conversationId,
    row.permissionRequestId,
    { outcome },
  )

  if (!applied) {
    return `That request expired, so ${row.toolName} did not run.`
  }
  return action === APPROVE_ACTION
    ? `Approved ${row.toolName}.`
    : `Denied ${row.toolName}.`
}

/**
 * Closes out specific approvals once their turn is over.
 *
 * Scoped to ids rather than the conversation: a turn ending must not
 * cancel a request another turn is still waiting on.
 */
export async function expireApprovals(approvalIds: string[]): Promise<void> {
  if (approvalIds.length === 0) return
  await getDb()
    .update(telegramApprovals)
    .set({ resolvedAt: new Date(), outcome: 'cancel' })
    .where(
      and(
        inArray(telegramApprovals.id, approvalIds),
        isNull(telegramApprovals.resolvedAt),
      ),
    )
    .run()
}

function kindLabel(kind: string | null): string {
  switch (kind) {
    case 'edit':
      return '✎'
    case 'delete':
      return '🗑'
    case 'execute':
      return '▶'
    case 'read':
    case 'search':
    case 'fetch':
      return '👁'
    default:
      return '🔧'
  }
}

const TARGET_KEYS = ['path', 'file_path', 'filePath', 'command', 'url'] as const

function describeTarget(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) return null
  for (const key of TARGET_KEYS) {
    if (!(key in input)) continue
    const value = (input as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim()) {
      return value.length > 120 ? `${value.slice(0, 119)}…` : value
    }
  }
  return null
}

// The thread that owns an approval, in the same encoded form the
// adapter hands back on a tap. Null when the conversation predates
// topics, where there is nothing narrower than the chat to compare.
async function findTopicByConversationForApproval(
  db: ReturnType<typeof getDb>,
  approvalId: string,
): Promise<string | null> {
  const row = await db
    .select({
      chatId: telegramTopics.telegramChatId,
      threadId: telegramTopics.messageThreadId,
    })
    .from(telegramApprovals)
    .innerJoin(
      telegramTopics,
      eq(telegramTopics.conversationId, telegramApprovals.conversationId),
    )
    .where(eq(telegramApprovals.id, approvalId))
    .get()
  if (!row || row.threadId === null) return null
  return `${row.chatId}:${row.threadId}`
}

// Drops the adapter prefix so the comparison is against the chat and
// topic alone.
function threadIdentity(threadId: string): string {
  return threadId.startsWith('telegram:')
    ? threadId.slice('telegram:'.length)
    : threadId
}
