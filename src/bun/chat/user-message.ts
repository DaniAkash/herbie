import { readFile } from 'node:fs/promises'
import type { ModelMessage, UserContent } from 'ai'
import type { Attachment } from '../../db/schema/attachments.sql'

/**
 * Build a `user` ModelMessage from text + optional attachments. With
 * no attachments the content is a plain string (the common case);
 * with attachments it's a parts array — image / file parts for the
 * uploads followed by the user's text.
 *
 * The file bytes are read on send. For v1 that means we keep the
 * whole payload in memory for the turn; >20 MB images would need a
 * streaming path, which we don't have today and the per-file cap
 * already enforces.
 */
export async function buildUserMessage(
  text: string,
  attachments: Attachment[],
): Promise<ModelMessage> {
  if (attachments.length === 0) {
    return { role: 'user', content: text }
  }
  const parts: UserContent = []
  for (const a of attachments) {
    const bytes = await readFile(a.storedPath)
    if (a.mimeType.startsWith('image/')) {
      parts.push({ type: 'image', image: bytes, mediaType: a.mimeType })
    } else {
      parts.push({
        type: 'file',
        data: bytes,
        mediaType: a.mimeType,
        filename: a.filename,
      })
    }
  }
  parts.push({ type: 'text', text })
  return { role: 'user', content: parts }
}
