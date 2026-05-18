import { createMutation, createQuery } from 'react-query-kit'
import { API_BASE_URL } from './client'

// Wire shape that POST /attachments returns. Kept narrow — the Hono
// client's InferResponseType doesn't cover the multipart route since
// it's defined imperatively (no Zod-validator wrapper), so this
// interface is the canonical client-side type.
export interface AttachmentResponse {
  id: string
  conversationId: string
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: number
  url: string
}

export interface UploadAttachmentInput {
  conversationId: string
  file: File
}

// Multipart upload — Hono's typed client can't model FormData so we
// fall back to a direct fetch. Server-side validates the agent caps +
// per-conversation quota before persisting; surface the body on
// failure so the toast layer can show a useful message.
async function uploadAttachment(
  input: UploadAttachmentInput,
): Promise<AttachmentResponse> {
  const form = new FormData()
  form.append('conversationId', input.conversationId)
  form.append('file', input.file)
  const res = await fetch(`${API_BASE_URL}/attachments`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // body wasn't JSON; keep the statusText fallback
    }
    throw new Error(message)
  }
  return (await res.json()) as AttachmentResponse
}

export const useUploadAttachment = createMutation<
  AttachmentResponse,
  UploadAttachmentInput
>({
  mutationFn: uploadAttachment,
})

async function deleteAttachment(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/attachments/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(res.statusText)
}

export const useDeleteAttachment = createMutation<void, string>({
  mutationFn: deleteAttachment,
})

async function fetchAttachment(id: string): Promise<AttachmentResponse> {
  const res = await fetch(`${API_BASE_URL}/attachments/${id}`)
  if (!res.ok) throw new Error(res.statusText)
  return (await res.json()) as AttachmentResponse
}

// Used by the transcript reducer to hydrate attachment metadata for
// any turn.start event that carries attachmentIds. Cached forever —
// the row is immutable once the upload settles, only delete can
// retire it (in which case the GET 404s).
export const useAttachment = createQuery<AttachmentResponse, { id: string }>({
  queryKey: ['attachments', 'one'],
  fetcher: ({ id }) => fetchAttachment(id),
  staleTime: Number.POSITIVE_INFINITY,
})

export function attachmentBlobUrl(id: string): string {
  return `${API_BASE_URL}/attachments/${id}/blob`
}
