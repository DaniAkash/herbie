// Staged-attachment types + small pure helpers used by the Composer.
// Lives in its own file so Composer.tsx stays under the per-file
// line cap; nothing here depends on React.

// Staged items are either already-uploaded (existing chat: the user
// dropped a file with a real conversationId in hand) or pending (new
// chat: we don't have a conversation row yet, so the bytes sit in
// memory until the first send mints one and uploads them in one go).
export type StagedAttachment =
  | {
      kind: 'uploaded'
      id: string
      filename: string
      mimeType: string
      blobUrl: string
    }
  | {
      kind: 'pending'
      // Local id (nanoid-ish; not a server attachment id) so chips
      // have a stable key + the remove button has something to target.
      localId: string
      file: File
      filename: string
      mimeType: string
      // Created via URL.createObjectURL so image chips can render the
      // bytes before they leave the renderer. Revoked on remove + send.
      blobUrl: string
    }

export interface ComposerSubmitAttachments {
  uploadedIds: string[]
  pendingFiles: File[]
}

export function stagedKey(item: StagedAttachment): string {
  return item.kind === 'uploaded' ? item.id : item.localId
}

export function pendingFromFile(file: File, index: number): StagedAttachment {
  return {
    kind: 'pending',
    localId: `${file.name}-${file.size}-${Date.now()}-${index}`,
    file,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    blobUrl: URL.createObjectURL(file),
  }
}
