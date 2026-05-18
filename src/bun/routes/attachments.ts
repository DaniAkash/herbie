import { mkdir, rm, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { eq, sum } from 'drizzle-orm'
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { attachments } from '../../db/schema/attachments.sql'
import { conversations } from '../../db/schema/conversations.sql'
import { getOrDiscoverCapabilities } from '../agents/agent-capabilities'
import { getDb } from '../db-singleton'

const ATTACHMENTS_DIR = path.join(homedir(), '.herbie', 'attachments')
const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB per file
const MAX_CONV_BYTES = 100 * 1024 * 1024 // 100 MB per conversation
// Anything outside [a-z0-9._-] is collapsed to '-' — keeps a hostile
// filename from escaping the per-conversation directory.
const SAFE_NAME = /[^a-z0-9._-]+/gi

export interface AttachmentPromptCaps {
  image: boolean
  audio: boolean
  embeddedContext: boolean
}

// Images-only for now — audio + embedded text/PDF rendering and
// tokenisation aren't wired up on the renderer or in the prompt path,
// and shipping them half-built is worse than not shipping them.
// Revisit once we add per-mime UI affordances.
export function mimeAllowed(
  mime: string,
  caps: AttachmentPromptCaps | undefined,
): boolean {
  if (!caps) return false
  if (!mime.startsWith('image/')) return false
  return caps.image
}

// Drops the per-conversation attachments directory. Called from the
// conv-delete handler — the FK `ON DELETE CASCADE` removes the rows,
// but the bytes on disk need an explicit recursive unlink.
export async function removeConversationAttachments(
  conversationId: string,
): Promise<void> {
  const dir = path.join(ATTACHMENTS_DIR, conversationId)
  await rm(dir, { recursive: true, force: true })
}

function serializeAttachment(row: typeof attachments.$inferSelect) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.getTime(),
    url: `/attachments/${row.id}/blob`,
  }
}

export const attachmentsRoute = new Hono()
  .post('/attachments', async (c) => {
    // Bun's form-data parser returns a single FormData; we expect
    // exactly one file under `file` and a `conversationId` text field.
    // Zod-validating multipart is awkward, so do it imperatively.
    const body = await c.req.parseBody()
    const file = body.file
    const conversationIdRaw = body.conversationId
    if (typeof conversationIdRaw !== 'string' || !conversationIdRaw) {
      return c.json({ error: 'conversationId is required' }, 400)
    }
    if (!(file instanceof File)) {
      return c.json({ error: 'file is required' }, 400)
    }
    if (file.size === 0) {
      return c.json({ error: 'file is empty' }, 400)
    }
    if (file.size > MAX_FILE_BYTES) {
      return c.json({ error: 'file exceeds 20 MB limit' }, 413)
    }

    const conversationId = conversationIdRaw
    const conv = await getDb()
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get()
    if (!conv) return c.json({ error: 'conversation not found' }, 404)

    // Probe-discovered prompt caps drive the gate. If the agent doesn't
    // accept the mime, fail fast with 415 so the renderer can surface
    // a useful error rather than a server-side decode failure later.
    const caps = await getOrDiscoverCapabilities(
      conv.agentId,
      conv.workspacePath ?? homedir(),
    )
    const mime = file.type || 'application/octet-stream'
    if (!mimeAllowed(mime, caps.promptCapabilities)) {
      return c.json({ error: `${conv.agentId} does not accept ${mime}` }, 415)
    }

    // Per-conversation quota — sum the existing rows, reject if this
    // upload would push past the cap.
    const existing = await getDb()
      .select({ total: sum(attachments.sizeBytes).as('total') })
      .from(attachments)
      .where(eq(attachments.conversationId, conversationId))
      .get()
    const usedBytes = Number(existing?.total ?? 0)
    if (usedBytes + file.size > MAX_CONV_BYTES) {
      return c.json({ error: 'conversation attachment quota exceeded' }, 413)
    }

    const id = nanoid()
    const safeName = file.name
      .toLowerCase()
      .replace(SAFE_NAME, '-')
      .slice(0, 80)
    const dir = path.join(ATTACHMENTS_DIR, conversationId)
    await mkdir(dir, { recursive: true })
    const storedPath = path.join(dir, `${id}-${safeName}`)
    await Bun.write(storedPath, await file.arrayBuffer())

    const row: typeof attachments.$inferSelect = {
      id,
      conversationId,
      filename: file.name,
      mimeType: mime,
      sizeBytes: file.size,
      storedPath,
      createdAt: new Date(),
    }
    await getDb().insert(attachments).values(row).run()
    return c.json(serializeAttachment(row))
  })
  .get('/attachments/:id', async (c) => {
    const id = c.req.param('id')
    const row = await getDb()
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .get()
    if (!row) return c.json({ error: 'not found' }, 404)
    return c.json(serializeAttachment(row))
  })
  .get('/attachments/:id/blob', async (c) => {
    const id = c.req.param('id')
    const row = await getDb()
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .get()
    if (!row) return c.json({ error: 'not found' }, 404)
    const blob = Bun.file(row.storedPath)
    return new Response(blob, {
      headers: {
        'content-type': row.mimeType,
        // RFC 5987 percent-encoded filename — Bun rejects raw header
        // values containing `:` or other CTL/separator chars, which
        // means uploads like "Screenshot 2026-05-18 at 3.43.51 PM.png"
        // would 500 here with a quoted filename. The filename* form
        // is unambiguous, UTF-8-safe, and supported everywhere.
        'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
        'content-length': String(row.sizeBytes),
      },
    })
  })
  .delete('/attachments/:id', async (c) => {
    const id = c.req.param('id')
    const row = await getDb()
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .get()
    if (!row) return c.json({ ok: true })
    await unlink(row.storedPath).catch(() => undefined)
    await getDb().delete(attachments).where(eq(attachments.id, id)).run()
    return c.json({ ok: true })
  })
