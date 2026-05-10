import { useNavigate } from '@tanstack/react-router'
import { FolderIcon, SparklesIcon } from 'lucide-react'
import { useState } from 'react'
import { Composer } from '@/components/chat/Composer'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateConversation } from '@/modules/api/chat.hooks'
import { useDefaultAgent } from '@/modules/api/settings.hooks'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import type { AgentId } from '@/modules/data/herbie-data.types'
import { clockTime } from '@/modules/utils/relativeTime'
import { useChatData } from './chat.data'
import { useSendMessage } from './chat.hooks'
import type { ChatMessage } from './chat.types'

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
  const [agent, setAgent] = useState<AgentId>(defaultAgent)
  const [workspaceId, setWorkspaceId] = useState<string | undefined>()

  const createMutation = useCreateConversation()
  const sendMutation = useSendMessage()

  async function handleSubmit(text: string) {
    const conv = await createMutation.mutateAsync({
      agentId: agent,
      title: text.slice(0, 60),
      workspaceId: workspaceId ?? null,
    })
    await sendMutation.mutateAsync({ id: conv.id, text })
    navigate({ to: '/chat/$id', params: { id: conv.id } })
  }

  function handleSchedule(text: string) {
    navigate({
      to: '/tasks/new',
      search: { prompt: text, agent, workspaceId },
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
        agent={agent}
        workspaceId={workspaceId}
        onAgentChange={setAgent}
        onWorkspaceChange={setWorkspaceId}
        onSubmit={handleSubmit}
        onSchedule={handleSchedule}
        autoFocus
        placeholder="Ask anything…"
      />
    </div>
  )
}

function ExistingChat({ conversationId }: { conversationId: string }) {
  const navigate = useNavigate()
  const { workspaces } = useHerbieData()
  const data = useChatData(conversationId)

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

  const conversation = data.conversation
  const agent = conversation.agentId as AgentId
  const workspaceId = conversation.workspaceId ?? undefined
  const workspaceName = workspaceId
    ? (workspaces.find((w) => w.id === workspaceId)?.name ?? workspaceId)
    : null

  function handleSubmit(text: string) {
    void data.sendMessage(text)
  }

  function handleSchedule(text: string) {
    navigate({
      to: '/tasks/new',
      search: { prompt: text, agent, workspaceId },
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
            {agent}
          </Badge>
          {workspaceName && (
            <Badge
              variant="outline"
              className="gap-1 font-mono text-[10px] text-muted-foreground"
            >
              <FolderIcon className="size-3" />
              {workspaceName}
            </Badge>
          )}
        </div>
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8 2xl:max-w-4xl">
          {data.messages.map((m) => (
            <ChatMessageRow key={m.id} message={m} agent={agent} />
          ))}
        </div>
      </div>
      <Composer
        agent={agent}
        workspaceId={workspaceId}
        // Agent + workspace are baked into the ACP session; mid-conversation
        // changes would require a fresh session. Treat as read-only for now.
        onAgentChange={() => {}}
        onWorkspaceChange={() => {}}
        onSubmit={handleSubmit}
        onSchedule={handleSchedule}
      />
    </div>
  )
}

function ChatMessageRow({
  message,
  agent,
}: {
  message: ChatMessage
  agent: AgentId
}) {
  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-secondary px-4 py-2.5 text-secondary-foreground text-sm leading-relaxed">
          {message.text}
        </div>
        <span className="px-2 text-[10px] text-muted-foreground/60 tabular-nums">
          {clockTime(message.createdAt)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono text-muted-foreground uppercase tracking-wider">
          {message.agent ?? agent}
        </span>
        {message.isStreaming && (
          <Badge variant="secondary" className="text-[10px]">
            streaming
          </Badge>
        )}
        {message.isCancelled && (
          <Badge variant="outline" className="text-[10px]">
            cancelled
          </Badge>
        )}
        {message.isError && (
          <Badge variant="destructive" className="text-[10px]">
            error
          </Badge>
        )}
        <span className="text-muted-foreground/60 tabular-nums">
          {clockTime(message.createdAt)}
        </span>
      </div>
      {message.text ? (
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
          {message.text}
        </div>
      ) : message.isStreaming ? (
        <div className="text-muted-foreground text-sm italic">thinking…</div>
      ) : null}
      {message.errorMessage && (
        <div className="rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-xs">
          {message.errorMessage}
        </div>
      )}
    </div>
  )
}
