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
