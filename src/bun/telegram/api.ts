// Minimal direct-REST helpers for the bits chat-sdk doesn't expose
// (or that we want to call before a Chat instance exists, like
// validating a token at save-time via /getMe).

interface TelegramApiResponse<T> {
  ok: boolean
  result?: T
  description?: string
  error_code?: number
}

interface TelegramBotUser {
  id: number
  is_bot: boolean
  username?: string
  first_name?: string
}

export interface ValidatedBot {
  username: string | null
  firstName: string | null
  id: number
}

export async function validateBotToken(token: string): Promise<ValidatedBot> {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  const body = (await res.json()) as TelegramApiResponse<TelegramBotUser>
  if (!body.ok || !body.result) {
    const reason = body.description ?? `HTTP ${res.status}`
    throw new Error(`Telegram rejected the bot token: ${reason}`)
  }
  return {
    id: body.result.id,
    username: body.result.username ?? null,
    firstName: body.result.first_name ?? null,
  }
}

export interface TelegramBotCommand {
  command: string
  description: string
}

// Registers the bot's slash-command catalog with Telegram so the
// native `/` autocomplete menu surfaces them. chat-sdk doesn't expose
// this — call it directly after chat.initialize() in the manager.
// Idempotent: every boot overwrites with the same list.
export async function setMyCommands(
  token: string,
  commands: readonly TelegramBotCommand[],
): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${token}/setMyCommands`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    },
  )
  const body = (await res.json()) as TelegramApiResponse<true>
  if (!body.ok) {
    const reason = body.description ?? `HTTP ${res.status}`
    throw new Error(`Telegram setMyCommands failed: ${reason}`)
  }
}

// --- Forum topics -------------------------------------------------
//
// The adapter does not expose these: its chat-target helpers are
// protected and its public surface stops at sending. Topic lifecycle
// is therefore driven straight against the Bot API, the same way
// setMyCommands above is.
//
// Topics in private chats arrived in Bot API 9.3. In a supergroup the
// bot needs the can_manage_topics right; in a private chat it does
// not, which is why Herbie only ever addresses the user's DM.

export interface ForumTopic {
  messageThreadId: number
  name: string
}

interface RawForumTopic {
  message_thread_id: number
  name: string
}

async function callBotApi<T>(
  token: string,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const body = (await res.json()) as TelegramApiResponse<T>
  if (!body.ok || body.result === undefined) {
    const reason = body.description ?? `HTTP ${res.status}`
    throw new TelegramApiError(method, reason, body.error_code, res)
  }
  return body.result
}

export class TelegramApiError extends Error {
  readonly method: string
  readonly code: number | undefined
  // Seconds Telegram asked us to wait. Present on 429s; ignoring it
  // costs the bot its send privileges for several minutes.
  readonly retryAfter: number | undefined

  constructor(
    method: string,
    reason: string,
    code: number | undefined,
    res: Response,
  ) {
    super(`Telegram ${method} failed: ${reason}`)
    this.name = 'TelegramApiError'
    this.method = method
    this.code = code
    const header = res.headers.get('retry-after')
    this.retryAfter = header ? Number(header) : undefined
  }
}

export async function createForumTopic(
  token: string,
  chatId: string,
  name: string,
): Promise<ForumTopic> {
  const raw = await callBotApi<RawForumTopic>(token, 'createForumTopic', {
    chat_id: chatId,
    name: truncateTopicName(name),
  })
  return { messageThreadId: raw.message_thread_id, name: raw.name }
}

export async function editForumTopic(
  token: string,
  chatId: string,
  messageThreadId: number,
  name: string,
): Promise<void> {
  await callBotApi<true>(token, 'editForumTopic', {
    chat_id: chatId,
    message_thread_id: messageThreadId,
    name: truncateTopicName(name),
  })
}

export async function closeForumTopic(
  token: string,
  chatId: string,
  messageThreadId: number,
): Promise<void> {
  await callBotApi<true>(token, 'closeForumTopic', {
    chat_id: chatId,
    message_thread_id: messageThreadId,
  })
}

export async function reopenForumTopic(
  token: string,
  chatId: string,
  messageThreadId: number,
): Promise<void> {
  await callBotApi<true>(token, 'reopenForumTopic', {
    chat_id: chatId,
    message_thread_id: messageThreadId,
  })
}

export async function deleteForumTopic(
  token: string,
  chatId: string,
  messageThreadId: number,
): Promise<void> {
  await callBotApi<true>(token, 'deleteForumTopic', {
    chat_id: chatId,
    message_thread_id: messageThreadId,
  })
}

// Telegram rejects topic names longer than 128 UTF-8 characters, and
// conversation titles have no such limit.
export const TOPIC_NAME_LIMIT = 128

export function truncateTopicName(name: string): string {
  const trimmed = name.trim() || 'Untitled'
  return [...trimmed].length <= TOPIC_NAME_LIMIT
    ? trimmed
    : `${[...trimmed].slice(0, TOPIC_NAME_LIMIT - 1).join('')}…`
}
