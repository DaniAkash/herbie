import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { AgentBusy } from '@/components/chat/AgentBusy'
import { Composer } from '@/components/chat/Composer'
import type { ComposerSubmitAttachments } from '@/components/chat/Composer.staging'
import {
  type ComposerTuple,
  PERMISSION_MODES,
  type PermissionMode,
} from '@/components/chat/composer.types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useMarkConversationSeen,
  useUpdateConversationTuple,
} from '@/modules/api/chat.hooks'
import { useDefaultPermissionMode } from '@/modules/api/settings.hooks'
import type { AgentId } from '@/modules/data/herbie-data.types'
import { NewChat } from './Chat.new'
import { ChatMessageRow } from './Chat.parts'
import { type UseChatDataResult, useChatData } from './chat.data'
import type { ConversationDetail } from './chat.hooks'

export interface ChatProps {
  conversationId: string | 'new'
}

export function Chat({ conversationId }: ChatProps) {
  if (conversationId === 'new') return <NewChat />
  return <ExistingChat conversationId={conversationId} />
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
    // `key={conversationId}` is load-bearing. Without it, navigating
    // between cached conversations reuses this component instance and
    // the composer's tuple useState (model, agent, permission mode,
    // etc.) survives the route param change.
    //
    // The path /chat/$id stays mounted across params, so React sees the
    // same component tree and reconciles ExistingChatBody as the same
    // instance. The brief <Skeleton /> branch above only unmounts on a
    // cache miss, so navigating to an uncached conversation cleans up
    // but navigating back to a cached one does not. That asymmetry
    // caused tuple selections to leak from one chat into another.
    //
    // useRef captures initial values only on first mount, and tuple
    // useState is preserved across re-renders. Both must reset whenever
    // the underlying conversation row changes. Forcing a remount via
    // the key is the simplest correct fix; the alternatives (sync
    // effects, derived state, useMemo-with-id) all reintroduce stale-
    // capture races. Do not remove this key without replacing it with
    // an equally hard remount guarantee.
    <ExistingChatBody
      key={conversationId}
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
  const { defaultPermissionMode } = useDefaultPermissionMode()
  // Fall back to the settings default when the conversation row's
  // permissionMode is NULL (conversations created before the 0018
  // migration, or rows whose stored value is no longer a recognised
  // mode). Resolves the narrowing to a real PermissionMode union.
  const rawConvMode = conversation.permissionMode as PermissionMode | null
  const initialTupleRef = useRef<ComposerTuple>({
    agentId: conversation.agentId as AgentId,
    modelId: conversation.modelId,
    workspacePath: conversation.workspacePath,
    reasoningEffort: conversation.reasoningEffort,
    permissionMode:
      rawConvMode && PERMISSION_MODES.includes(rawConvMode)
        ? rawConvMode
        : defaultPermissionMode,
  })
  const [tuple, setTuple] = useState<ComposerTuple>(initialTupleRef.current)
  // Synchronous mirror of the latest tuple — diff against this instead
  // of the closure-captured `tuple` so rapid clicks (A→B→A before a
  // re-render) compute the right diff. Without the ref the second
  // call sees the stale render-time tuple and silently drops its
  // PATCH, leaving the row out of sync with the UI.
  const tupleRef = useRef<ComposerTuple>(initialTupleRef.current)
  const updateTuple = useUpdateConversationTuple()

  // Eagerly PATCHes any changed tuple fields back to the conversation
  // row, so picker selections persist across navigate-away. Without
  // this the row only updated on send (via ChatSession.persistTuple),
  // and the picked-but-not-yet-sent value lived purely in local React
  // state — lost on unmount.
  function handleTupleChange(next: ComposerTuple) {
    const prev = tupleRef.current
    tupleRef.current = next
    setTuple(next)
    const diff: Partial<ComposerTuple> = {}
    if (next.agentId !== prev.agentId) diff.agentId = next.agentId
    if (next.modelId !== prev.modelId) diff.modelId = next.modelId
    if (next.workspacePath !== prev.workspacePath) {
      diff.workspacePath = next.workspacePath
    }
    if (next.reasoningEffort !== prev.reasoningEffort) {
      diff.reasoningEffort = next.reasoningEffort
    }
    if (next.permissionMode !== prev.permissionMode) {
      diff.permissionMode = next.permissionMode
    }
    if (Object.keys(diff).length === 0) return
    void updateTuple.mutateAsync({ id: conversationId, tuple: diff })
  }

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
            <ChatMessageRow
              key={m.id}
              message={m}
              agent={tuple.agentId}
              conversationId={conversationId}
            />
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
        onTupleChange={handleTupleChange}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onSchedule={handleSchedule}
      />
    </div>
  )
}
