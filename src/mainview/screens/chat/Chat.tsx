import { useNavigate } from '@tanstack/react-router'
import { SparklesIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { AgentBusy } from '@/components/chat/AgentBusy'
import { Composer } from '@/components/chat/Composer'
import type { ComposerSubmitAttachments } from '@/components/chat/Composer.staging'
import type { ComposerTuple } from '@/components/chat/composer.types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useUploadAttachment } from '@/modules/api/attachments.hooks'
import {
  useCreateConversation,
  useMarkConversationSeen,
} from '@/modules/api/chat.hooks'
import { useDefaultAgent } from '@/modules/api/settings.hooks'
import type { AgentId } from '@/modules/data/herbie-data.types'
import { ChatMessageRow } from './Chat.parts'
import { type UseChatDataResult, useChatData } from './chat.data'
import type { ConversationDetail } from './chat.hooks'
import { useSendMessage } from './chat.hooks'

export interface ChatProps {
  conversationId: string | 'new'
}

export function Chat({ conversationId }: ChatProps) {
  if (conversationId === 'new') return <NewChat />
  return <ExistingChat conversationId={conversationId} />
}

function NewChat() {
  const navigate = useNavigate()
  const { defaultAgent } = useDefaultAgent()
  // Tuple stays derived from the saved default until the user explicitly
  // picks something — that way the settings query resolving after first
  // paint doesn't leave us frozen on the fallback.
  const [pickedTuple, setPickedTuple] = useState<ComposerTuple | null>(null)
  const tuple: ComposerTuple = pickedTuple ?? {
    agentId: defaultAgent,
    modelId: null,
    workspacePath: null,
    reasoningEffort: null,
  }

  const createMutation = useCreateConversation()
  const sendMutation = useSendMessage()
  const uploadMutation = useUploadAttachment()

  async function handleSubmit(
    text: string,
    attachments: ComposerSubmitAttachments,
  ) {
    // The new-chat surface doesn't have a conversation id yet, so any
    // attachments the user picked are buffered in the Composer as File
    // objects. Mint the conversation first, then upload the pending
    // files under its id, then send everything together so the agent
    // sees the user message + attachments as one turn.
    const conv = await createMutation.mutateAsync({
      agentId: tuple.agentId,
      title: text.slice(0, 60),
      modelId: tuple.modelId,
      workspacePath: tuple.workspacePath,
      reasoningEffort: tuple.reasoningEffort,
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
        // The conversation row is already created — surface it so the
        // user can retry without losing their typed prompt.
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
            work on a specific project — or just ask anything.
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

function ExistingChat({ conversationId }: { conversationId: string }) {
  const data = useChatData(conversationId)
  const markSeen = useMarkConversationSeen()

  // Clear the sidebar unread badge whenever the user opens a
  // conversation. mutateAsync is identity-stable across renders, so
  // the effect fires once per conversation per mount. Failures are
  // silent — the next telegram-chats poll refreshes the badge.
  const markSeenMutate = markSeen.mutateAsync
  useEffect(() => {
    void markSeenMutate({ id: conversationId }).catch(() => {})
  }, [conversationId, markSeenMutate])

  if (data.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-6 py-8">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  if (!data.conversation) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Conversation not found.</p>
      </div>
    )
  }

  return (
    <ExistingChatBody
      conversationId={conversationId}
      conversation={data.conversation}
      data={data}
    />
  )
}

function ExistingChatBody({
  conversationId,
  conversation,
  data,
}: {
  conversationId: string
  conversation: NonNullable<ConversationDetail['conversation']>
  data: UseChatDataResult
}) {
  const navigate = useNavigate()
  // Captured at first paint; stays stable across the body's lifetime so the
  // switch warning fires only on user-driven changes (and stops once we've
  // actually committed a switch via send).
  const initialTupleRef = useRef<ComposerTuple>({
    agentId: conversation.agentId as AgentId,
    modelId: conversation.modelId,
    workspacePath: conversation.workspacePath,
    reasoningEffort: conversation.reasoningEffort,
  })
  const [tuple, setTuple] = useState<ComposerTuple>(initialTupleRef.current)

  function handleSubmit(text: string, attachments: ComposerSubmitAttachments) {
    // Existing chats always have a conversationId, so the Composer's
    // paperclip uploads each file directly and there are no
    // pendingFiles to fold in here.
    void data.sendMessage({
      id: conversationId,
      text,
      agentId: tuple.agentId,
      modelId: tuple.modelId,
      workspacePath: tuple.workspacePath,
      reasoningEffort: tuple.reasoningEffort,
      attachmentIds: attachments.uploadedIds,
    })
  }

  function handleCancel() {
    void data.cancelTurn()
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
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader maxWidth="max-w-3xl" className="justify-between">
        <h1 className="min-w-0 truncate font-semibold text-base tracking-tight">
          {conversation.title}
        </h1>
        <div className="flex shrink-0 items-center gap-1.5 text-xs">
          <Badge variant="outline" className="font-mono text-[10px]">
            {tuple.agentId}
          </Badge>
        </div>
      </PageHeader>
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl 2xl:max-w-4xl">
          {data.messages.map((m) => (
            <ChatMessageRow key={m.id} message={m} agent={tuple.agentId} />
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {/* Anchored above the composer (NOT inside the scrollable
          ConversationContent) so the elapsed-time + token counters stay
          still as messages stream in and the user scrolls. */}
      <div className="px-6">
        <div className="mx-auto max-w-3xl">
          <AgentBusy
            isStreaming={data.isStreaming}
            startedAt={data.activeAssistant?.startedAt ?? 0}
            outputChars={data.activeAssistant?.liveOutputChars ?? 0}
            inputChars={data.activeAssistant?.approxInputChars}
          />
        </div>
      </div>
      <Composer
        tuple={tuple}
        initialTuple={initialTupleRef.current}
        hasPriorTurns={data.messages.length > 0}
        isStreaming={data.isStreaming}
        conversationId={conversationId}
        onTupleChange={setTuple}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onSchedule={handleSchedule}
      />
    </div>
  )
}
