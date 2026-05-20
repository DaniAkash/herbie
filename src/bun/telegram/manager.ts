import {
  createTelegramAdapter,
  type TelegramAdapter,
} from '@chat-adapter/telegram'
import { Chat, type Thread } from 'chat'
import { eq } from 'drizzle-orm'
import {
  type TelegramConnection,
  telegramConnections,
} from '../../db/schema/telegram-connections.sql'
import { getDb } from '../db-singleton'
import { decryptSecret } from '../security/secrets'
import { setMyCommands, type TelegramBotCommand } from './api'
import { handleIncomingTelegramMessage } from './bridge'
import { MemoryStateAdapter } from './state-adapter'

// Slash-command catalogs surfaced in Telegram's native autocomplete
// menu via setMyCommands. The two bot kinds advertise different sets:
// remote_control bots get the full management interface; special
// purpose bots only need /help since their behavior is just
// "messages route to the assigned conversation."
const REMOTE_CONTROL_COMMANDS: readonly TelegramBotCommand[] = [
  { command: 'new', description: 'Start a new conversation' },
  { command: 'list', description: 'Show all conversations' },
  { command: 'switch', description: 'Switch active conversation' },
  { command: 'current', description: 'Show active conversation' },
  { command: 'archive', description: 'Archive a conversation' },
  { command: 'unarchive', description: 'Restore an archived conversation' },
  { command: 'help', description: 'Show command list' },
]
const SPECIAL_PURPOSE_COMMANDS: readonly TelegramBotCommand[] = [
  { command: 'help', description: 'Show what this bot does' },
]

type RunningBot = {
  connectionId: string
  chat: Chat<{ telegram: TelegramAdapter }>
  adapter: TelegramAdapter
}

class TelegramManager {
  private readonly bots = new Map<string, RunningBot>()
  private readonly starting = new Map<string, Promise<void>>()

  async startAll(): Promise<void> {
    const rows = await getDb()
      .select()
      .from(telegramConnections)
      .where(eq(telegramConnections.status, 'active'))
      .all()
    await Promise.allSettled(rows.map((r) => this.start(r)))
  }

  async start(connection: TelegramConnection): Promise<void> {
    if (this.bots.has(connection.id)) return
    const existing = this.starting.get(connection.id)
    if (existing) return existing

    const launch = this.doStart(connection).finally(() => {
      this.starting.delete(connection.id)
    })
    this.starting.set(connection.id, launch)
    return launch
  }

  async stop(connectionId: string): Promise<void> {
    const running = this.bots.get(connectionId)
    if (!running) return
    this.bots.delete(connectionId)
    try {
      await running.chat.shutdown()
    } catch (err) {
      logError(connectionId, 'shutdown failed', err)
    }
  }

  async restart(connection: TelegramConnection): Promise<void> {
    await this.stop(connection.id)
    await this.start(connection)
  }

  async stopAll(): Promise<void> {
    const ids = [...this.bots.keys()]
    await Promise.allSettled(ids.map((id) => this.stop(id)))
  }

  getStatus(connectionId: string): 'running' | 'starting' | 'stopped' {
    if (this.bots.has(connectionId)) return 'running'
    if (this.starting.has(connectionId)) return 'starting'
    return 'stopped'
  }

  // Returns a Thread handle for posting outside the inbound handler
  // flow (e.g. mirroring app-typed user messages back to Telegram).
  // Null when the bot for that connection isn't running.
  getThread(connectionId: string, telegramChatId: string): Thread | null {
    const running = this.bots.get(connectionId)
    if (!running) return null
    const threadId = running.adapter.encodeThreadId({
      chatId: telegramChatId,
    })
    return running.chat.thread(threadId)
  }

  private async doStart(connection: TelegramConnection): Promise<void> {
    let botToken: string
    try {
      botToken = await decryptSecret(connection.botTokenEncrypted)
    } catch (err) {
      await this.markError(connection.id, errorMessage(err))
      return
    }

    const adapter = createTelegramAdapter({
      botToken,
      mode: 'polling',
      userName: connection.botUsername ?? 'herbie-bot',
    })
    const userName = connection.botUsername ?? 'herbie-bot'
    const chat = new Chat<{ telegram: TelegramAdapter }>({
      userName,
      adapters: { telegram: adapter },
      state: new MemoryStateAdapter(),
      logger: 'warn',
    })

    // Three entry points → the same bridge:
    //  - onDirectMessage: 1:1 DMs (Telegram private chats)
    //  - onNewMention: a @-mention in a group, first time
    //  - onSubscribedMessage: every follow-up after we subscribe
    // Subscribing in the first two routes follow-ups through
    // onSubscribedMessage, which keeps the agent in the same
    // conversation rather than re-handshaking each turn.
    chat.onDirectMessage(async (thread, message) => {
      await thread.subscribe()
      await handleIncomingTelegramMessage(connection, thread, message)
    })
    chat.onNewMention(async (thread, message) => {
      await thread.subscribe()
      await handleIncomingTelegramMessage(connection, thread, message)
    })
    chat.onSubscribedMessage(async (thread, message) => {
      await handleIncomingTelegramMessage(connection, thread, message)
    })

    try {
      await chat.initialize()
    } catch (err) {
      await this.markError(connection.id, errorMessage(err))
      // chat-sdk holds resources even on a failed init — flush them so
      // a retry doesn't leak the previous polling loop.
      try {
        await chat.shutdown()
      } catch {}
      return
    }

    this.bots.set(connection.id, {
      connectionId: connection.id,
      chat,
      adapter,
    })
    await this.clearError(connection.id)

    // Register the slash-command catalog with Telegram so the native
    // `/` autocomplete menu surfaces them. Non-fatal — the bot still
    // works without the menu, the user just doesn't get autocomplete.
    const commands =
      connection.kind === 'remote_control'
        ? REMOTE_CONTROL_COMMANDS
        : SPECIAL_PURPOSE_COMMANDS
    try {
      await setMyCommands(botToken, commands)
    } catch (err) {
      logError(connection.id, 'setMyCommands failed', err)
    }
  }

  private async markError(
    connectionId: string,
    message: string,
  ): Promise<void> {
    await getDb()
      .update(telegramConnections)
      .set({ status: 'error', lastError: message, updatedAt: new Date() })
      .where(eq(telegramConnections.id, connectionId))
      .run()
    logError(connectionId, 'bot startup failed', message)
  }

  private async clearError(connectionId: string): Promise<void> {
    await getDb()
      .update(telegramConnections)
      .set({ lastError: null, updatedAt: new Date() })
      .where(eq(telegramConnections.id, connectionId))
      .run()
  }
}

let instance: TelegramManager | null = null

export function getTelegramManager(): TelegramManager {
  if (!instance) instance = new TelegramManager()
  return instance
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function logError(connectionId: string, label: string, err: unknown): void {
  // biome-ignore lint/suspicious/noConsole: only surfaces in dev/CI runs
  console.error(`[telegram:${connectionId}] ${label}:`, err)
}
