import type { Thread } from 'chat'
import type { DB } from '../../db'
import type { TelegramConnection } from '../../db/schema/telegram-connections.sql'
import { getDb } from '../db-singleton'
import {
  cmdCurrent,
  cmdHelp,
  cmdList,
  cmdRedirectSpecialPurpose,
  cmdUnknown,
} from './commands.read'
import { cmdArchive, cmdNew, cmdSwitch, cmdUnarchive } from './commands.write'

// Bot command interception. The bridge calls handleBotCommand before
// running the AI turn pipeline. If the text was a command, this
// returns true and the bridge bails out. Non-commands fall through.
//
// Commands are only meaningful on remote_control bots. Special-purpose
// bots reply to /start and /help with a brief explainer and politely
// redirect management commands so users aren't confused why /list
// doesn't work.

type CommandHandler = (
  db: DB,
  connection: TelegramConnection,
  thread: Thread,
  telegramChatId: string,
  args: string[],
) => Promise<void>

// Dispatch table keeps handleBotCommand's branch count low (one
// switch with N cases lights up the noExcessiveCognitiveComplexity
// rule; a lookup is constant complexity regardless of catalog size).
// Only remote_control bots reach this map; the kind gate runs first.
const REMOTE_CONTROL_HANDLERS: Record<string, CommandHandler> = {
  list: (db, conn, thread, chatId) => cmdList(db, conn, thread, chatId),
  new: (db, conn, thread, chatId, args) =>
    cmdNew(db, conn, thread, chatId, args.join(' ').trim()),
  switch: (db, conn, thread, chatId, args) =>
    cmdSwitch(db, conn, thread, chatId, args[0] ?? ''),
  current: (db, conn, thread, chatId) => cmdCurrent(db, conn, thread, chatId),
  archive: (db, conn, thread, chatId, args) =>
    cmdArchive(db, conn, thread, chatId, args[0] ?? ''),
  unarchive: (db, conn, thread, chatId) =>
    cmdUnarchive(db, conn, thread, chatId),
}

export async function handleBotCommand(
  connection: TelegramConnection,
  thread: Thread,
  telegramChatId: string,
  text: string,
): Promise<boolean> {
  if (!text.startsWith('/')) return false
  const parsed = parseCommand(text)
  if (!parsed) return false

  const { name, args } = parsed
  const db = getDb()

  // /start and /help are universal — every bot replies so first-time
  // users get oriented.
  if (name === 'start' || name === 'help') {
    await cmdHelp(connection, thread)
    return true
  }

  if (connection.kind === 'special_purpose') {
    await cmdRedirectSpecialPurpose(thread, name)
    return true
  }

  const handler = REMOTE_CONTROL_HANDLERS[name]
  if (handler) {
    await handler(db, connection, thread, telegramChatId, args)
    return true
  }
  await cmdUnknown(thread, name)
  return true
}

// Parses '/cmd', '/cmd arg1 arg2', '/cmd@botname arg1', etc. Returns
// the command name lowercased with any @<botUsername> suffix stripped,
// and the remaining whitespace-split args. Returns null for inputs
// that don't look like a command (e.g. just '/').
function parseCommand(text: string): { name: string; args: string[] } | null {
  const body = text.slice(1).trim()
  if (!body) return null
  const tokens = body.split(/\s+/)
  let head = tokens[0] ?? ''
  // Telegram appends '@<botUsername>' onto commands sent in groups when
  // more than one bot is present (and sometimes always). Strip it.
  const atIdx = head.indexOf('@')
  if (atIdx >= 0) head = head.slice(0, atIdx)
  const name = head.toLowerCase()
  if (!name) return null
  return { name, args: tokens.slice(1) }
}
