import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { conversations } from './conversations.sql'

// One row per uploaded file. The bytes live on disk under
// `~/.herbie/attachments/<conversationId>/<id>-<safe-filename>`; this
// row carries the metadata + a pointer.
//
// `ON DELETE CASCADE` drops the rows when a conversation is deleted.
// The conv-delete route also `unlink`s the disk files, since the FK
// only knows about the DB side.
export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  // Original filename on the user's machine — surfaced in the UI for
  // recognition. Not used for disk storage (the safe-name variant is).
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  // Absolute path on this Mac — written + read by the bun side only.
  storedPath: text('stored_path').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export type Attachment = typeof attachments.$inferSelect
