import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { conversations } from '../../db/schema/conversations.sql'
import { pendingTelegramLinks } from '../../db/schema/pending-telegram-links.sql'
import { telegramConnections } from '../../db/schema/telegram-connections.sql'
import { getDb } from '../db-singleton'
import { reassignSpecialPurposeBot } from '../telegram/reassign'

// Tokens live for 30 minutes. Long enough that a user can switch
// devices / unlock a phone, short enough that a stale token tapped
// from an old SMS / browser tab a week later doesn't accidentally
// re-link a conversation.
const LINK_TTL_MS = 30 * 60 * 1000

const createLinkSchema = z.object({
  conversationId: z.string().min(1),
})

const reassignSchema = z.object({
  conversationId: z.string().min(1),
})

// Maps a reassignSpecialPurposeBot error code to (status, message).
function reassignErrorResponse(code: string): {
  status: 400 | 404 | 409
  message: string
} {
  switch (code) {
    case 'connection_not_found':
      return { status: 404, message: 'connection not found' }
    case 'conversation_not_found':
      return { status: 404, message: 'conversation not found' }
    case 'not_special_purpose':
      return {
        status: 400,
        message:
          'only special-purpose bots can be reassigned; remote-control bots manage their pool via /switch',
      }
    case 'conversation_archived':
      return { status: 400, message: 'cannot link an archived conversation' }
    case 'no_change':
      return {
        status: 409,
        message: 'bot is already linked to this conversation',
      }
    default:
      return { status: 400, message: code }
  }
}

// "Send to Telegram" endpoints. The desktop popup mints a token via
// POST, renders the deep link / QR code, and polls GET while waiting
// for the user to tap START in Telegram. The bot's /start handler
// (src/bun/telegram/linking.ts) consumes the token.
//
// The GET poll returns only 'pending' or 'gone' — it can't reliably
// distinguish "consumed" from "expired" without a separate ledger.
// The popup determines success by checking whether the source
// conversation now has a telegramLink via GET /chat, then closes
// itself with a success message.
export const telegramLinksRoute = new Hono()
  .post(
    '/telegram/connections/:id/links',
    zValidator('json', createLinkSchema),
    async (c) => {
      const connectionId = c.req.param('id')
      const { conversationId } = c.req.valid('json')

      const db = getDb()
      const connection = await db
        .select()
        .from(telegramConnections)
        .where(eq(telegramConnections.id, connectionId))
        .get()
      if (!connection) {
        return c.json({ error: 'connection not found' }, 404)
      }
      const conv = await db
        .select({ id: conversations.id, archivedAt: conversations.archivedAt })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .get()
      if (!conv) {
        return c.json({ error: 'conversation not found' }, 404)
      }
      if (conv.archivedAt) {
        return c.json({ error: 'cannot link an archived conversation' }, 400)
      }

      const token = nanoid()
      const now = new Date()
      const expiresAt = new Date(now.getTime() + LINK_TTL_MS)
      await db
        .insert(pendingTelegramLinks)
        .values({
          token,
          connectionId,
          conversationId,
          createdAt: now,
          expiresAt,
        })
        .run()

      const botUsername = connection.botUsername
      const deepLinkUrl = botUsername
        ? `https://t.me/${botUsername}?start=link_${token}`
        : null
      return c.json({
        token,
        deepLinkUrl,
        botUsername,
        expiresAt: expiresAt.getTime(),
      })
    },
  )
  // Reassign a special-purpose bot to a different conversation.
  // Distinct from the link flow because the bot already has a known
  // Telegram chat — no /start handshake needed. Posts the
  // "this bot has been reassigned" notice to every Telegram chat the
  // bot lives in.
  .post(
    '/telegram/connections/:id/reassign',
    zValidator('json', reassignSchema),
    async (c) => {
      const connectionId = c.req.param('id')
      const { conversationId } = c.req.valid('json')
      const result = await reassignSpecialPurposeBot(
        connectionId,
        conversationId,
      )
      if (!result.ok) {
        const { status, message } = reassignErrorResponse(result.code)
        return c.json({ error: message }, status)
      }
      return c.json({
        ok: true,
        previousConversationTitle: result.previousConversationTitle,
        newConversationTitle: result.newConversationTitle,
        chatsNotified: result.chatsNotified,
      })
    },
  )
  .get('/telegram/links/:token', async (c) => {
    const token = c.req.param('token')
    const link = await getDb()
      .select()
      .from(pendingTelegramLinks)
      .where(eq(pendingTelegramLinks.token, token))
      .get()
    if (!link) return c.json({ status: 'gone' as const })
    if (link.expiresAt < new Date()) {
      return c.json({ status: 'gone' as const })
    }
    return c.json({
      status: 'pending' as const,
      expiresAt: link.expiresAt.getTime(),
    })
  })
