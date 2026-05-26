import { useNavigate } from '@tanstack/react-router'
import { SparklesIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Composer } from '@/components/chat/Composer'
import type { ComposerSubmitAttachments } from '@/components/chat/Composer.staging'
import type { ComposerTuple } from '@/components/chat/composer.types'
import { PageHeader } from '@/components/layout/PageHeader'
import { useUploadAttachment } from '@/modules/api/attachments.hooks'
import { useCreateConversation } from '@/modules/api/chat.hooks'
import {
  useDefaultAgent,
  useDefaultPermissionMode,
} from '@/modules/api/settings.hooks'
import { useSendMessage } from './chat.hooks'

export function NewChat() {
  const navigate = useNavigate()
  const { defaultAgent } = useDefaultAgent()
  const { defaultPermissionMode } = useDefaultPermissionMode()
  // Tuple stays derived from the saved default until the user explicitly
  // picks something, so a late-resolving settings query doesn't freeze
  // the picker on the fallback.
  const [pickedTuple, setPickedTuple] = useState<ComposerTuple | null>(null)
  const tuple: ComposerTuple = pickedTuple ?? {
    agentId: defaultAgent,
    modelId: null,
    workspacePath: null,
    reasoningEffort: null,
    permissionMode: defaultPermissionMode,
  }

  const createMutation = useCreateConversation()
  const sendMutation = useSendMessage()
  const uploadMutation = useUploadAttachment()

  async function handleSubmit(
    text: string,
    attachments: ComposerSubmitAttachments,
  ) {
    // No conv id yet, so pending files are buffered as File objects in
    // the Composer. Mint the conv, upload under its id, then send so
    // the agent sees the message + attachments as one turn.
    const conv = await createMutation.mutateAsync({
      agentId: tuple.agentId,
      title: text.slice(0, 60),
      modelId: tuple.modelId,
      workspacePath: tuple.workspacePath,
      reasoningEffort: tuple.reasoningEffort,
      permissionMode: tuple.permissionMode,
    })
    let uploadedIds = attachments.uploadedIds
    if (attachments.pendingFiles.length > 0) {
      try {
        const uploaded = await Promise.all(
          attachments.pendingFiles.map((file) =>
            uploadMutation.mutateAsync({ conversationId: conv.id, file }),
          ),
        )
        uploadedIds = [...uploadedIds, ...uploaded.map((u) => u.id)]
      } catch (err) {
        toast.error('Upload failed', { description: String(err) })
        // Conv row already exists; surface it so the user can retry
        // without losing the typed prompt.
        navigate({ to: '/chat/$id', params: { id: conv.id } })
        return
      }
    }
    await sendMutation.mutateAsync({
      id: conv.id,
      text,
      agentId: tuple.agentId,
      modelId: tuple.modelId,
      workspacePath: tuple.workspacePath,
      reasoningEffort: tuple.reasoningEffort,
      attachmentIds: uploadedIds,
    })
    navigate({ to: '/chat/$id', params: { id: conv.id } })
  }

  function handleSchedule(text: string) {
    navigate({
      to: '/tasks/new',
      search: {
        prompt: text,
        agent: tuple.agentId,
        workspacePath: tuple.workspacePath ?? undefined,
      },
    })
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader maxWidth="max-w-3xl">
        <div className="md:hidden" />
      </PageHeader>
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="flex max-w-lg flex-col items-center text-center">
          <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
            <SparklesIcon className="size-5" />
          </div>
          <h2 className="font-semibold text-3xl tracking-tight">
            What's on your mind?
          </h2>
          <p className="mt-2 max-w-md text-balance text-muted-foreground text-sm leading-relaxed">
            Start a chat with your agents. Pick a workspace if you want them to
            work on a specific project, or just ask anything.
          </p>
        </div>
      </div>
      <Composer
        tuple={tuple}
        onTupleChange={setPickedTuple}
        onSubmit={handleSubmit}
        onSchedule={handleSchedule}
        autoFocus
        placeholder="Ask anything…"
      />
    </div>
  )
}
