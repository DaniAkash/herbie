import { type ChangeEvent, useState } from 'react'
import { toast } from 'sonner'
import {
  attachmentBlobUrl,
  useDeleteAttachment,
  useUploadAttachment,
} from '@/modules/api/attachments.hooks'
import {
  pendingFromFile,
  type StagedAttachment,
  stagedKey,
} from './Composer.staging'

interface UseComposerStagingArgs {
  conversationId?: string
}

export function useComposerStaging({ conversationId }: UseComposerStagingArgs) {
  const [staged, setStaged] = useState<StagedAttachment[]>([])
  const upload = useUploadAttachment()
  const remove = useDeleteAttachment()

  async function stageUploadedFile(convId: string, file: File): Promise<void> {
    try {
      const uploaded = await upload.mutateAsync({
        conversationId: convId,
        file,
      })
      setStaged((prev) => [
        ...prev,
        {
          kind: 'uploaded',
          id: uploaded.id,
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          // Renderer host differs from API host — needs absolute URL.
          blobUrl: attachmentBlobUrl(uploaded.id),
        },
      ])
    } catch (err) {
      toast.error('Upload failed', { description: String(err) })
    }
  }

  async function handleFiles(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = e.target.files
    if (!files) return
    const list = Array.from(files)
    if (conversationId) {
      for (const file of list) {
        await stageUploadedFile(conversationId, file)
      }
    } else {
      // New chat — no conv row yet; parent orchestrates create → upload → send.
      setStaged((prev) => [
        ...prev,
        ...list.map((file, i) => pendingFromFile(file, prev.length + i)),
      ])
    }
    e.target.value = ''
  }

  function handleRemoveStaged(key: string): void {
    const target = staged.find((item) => stagedKey(item) === key)
    if (!target) return
    if (target.kind === 'pending') {
      URL.revokeObjectURL(target.blobUrl)
    } else {
      void remove.mutateAsync(target.id).catch(() => undefined)
    }
    setStaged((prev) => prev.filter((item) => stagedKey(item) !== key))
  }

  function revokePendingUrls(): void {
    for (const item of staged) {
      if (item.kind === 'pending') URL.revokeObjectURL(item.blobUrl)
    }
  }

  return {
    staged,
    setStaged,
    upload,
    handleFiles,
    handleRemoveStaged,
    revokePendingUrls,
  }
}
