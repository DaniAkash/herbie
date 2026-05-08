import { useNavigate } from '@tanstack/react-router'
import { ChevronDownIcon, FolderIcon, SparklesIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Composer } from '@/components/chat/Composer'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { useDefaultAgent } from '@/modules/api/appSettings.hooks'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import type {
  AgentId,
  Message as HMessage,
} from '@/modules/data/herbie-data.types'
import { clockTime } from '@/modules/utils/relativeTime'

export type ChatProps = {
  conversationId: string | 'new'
}

export function Chat({ conversationId }: ChatProps) {
  const navigate = useNavigate()
  const {
    conversations,
    messages,
    workspaces,
    createConversation,
    appendMessage,
    setConversationAgent,
    setConversationWorkspace,
  } = useHerbieData()
  const { defaultAgent } = useDefaultAgent()

  const isNew = conversationId === 'new'
  const conversation = isNew
    ? null
    : conversations.find((c) => c.id === conversationId)

  const conversationMessages = useMemo(
    () =>
      isNew
        ? []
        : messages
            .filter((m) => m.conversationId === conversationId)
            .sort((a, b) => a.createdAt - b.createdAt),
    [messages, conversationId, isNew],
  )

  const activeAgent: AgentId = conversation?.defaultAgent ?? defaultAgent
  const activeWorkspace = conversation?.workspaceId

  function handleSubmit(text: string) {
    if (isNew) {
      const conv = createConversation({
        title: text.slice(0, 60),
        defaultAgent: activeAgent,
        workspaceId: activeWorkspace,
      })
      appendMessage({ conversationId: conv.id, role: 'user', text })
      navigate({ to: '/c/$id', params: { id: conv.id } })
      return
    }
    appendMessage({ conversationId, role: 'user', text })
  }

  function handleSchedule(text: string) {
    navigate({
      to: '/tasks/new',
      search: {
        prompt: text,
        agent: activeAgent,
        workspaceId: activeWorkspace,
      },
    })
  }

  function handleAgentChange(agent: AgentId) {
    if (isNew) return
    setConversationAgent(conversationId, agent)
  }

  function handleWorkspaceChange(id: string | undefined) {
    if (isNew) return
    setConversationWorkspace(conversationId, id)
  }

  const activeWorkspaceName = activeWorkspace
    ? (workspaces.find((w) => w.id === activeWorkspace)?.name ??
      activeWorkspace)
    : null

  if (isNew) {
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
              Start a chat with your agents. Pick a workspace if you want them
              to work on a specific project — or just ask anything.
            </p>
          </div>
        </div>
        <Composer
          agent={activeAgent}
          workspaceId={activeWorkspace}
          onAgentChange={handleAgentChange}
          onWorkspaceChange={handleWorkspaceChange}
          onSubmit={handleSubmit}
          onSchedule={handleSchedule}
          autoFocus
          placeholder="Ask anything…"
        />
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Conversation not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader maxWidth="max-w-3xl" className="justify-between">
        <h1 className="min-w-0 truncate font-semibold text-base tracking-tight">
          {conversation.title}
        </h1>
        <div className="flex shrink-0 items-center gap-1.5 text-xs">
          <Badge variant="outline" className="font-mono text-[10px]">
            {activeAgent}
          </Badge>
          {activeWorkspaceName && (
            <Badge
              variant="outline"
              className="gap-1 font-mono text-[10px] text-muted-foreground"
            >
              <FolderIcon className="size-3" />
              {activeWorkspaceName}
            </Badge>
          )}
        </div>
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8 2xl:max-w-4xl">
          {conversationMessages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}
        </div>
      </div>
      <Composer
        agent={activeAgent}
        workspaceId={activeWorkspace}
        onAgentChange={handleAgentChange}
        onWorkspaceChange={handleWorkspaceChange}
        onSubmit={handleSubmit}
        onSchedule={handleSchedule}
      />
    </div>
  )
}

function ChatMessage({ message }: { message: HMessage }) {
  const [reasoningOpen, setReasoningOpen] = useState(false)
  const isUser = message.role === 'user'
  const text = message.parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('\n\n')
  const reasoning = message.parts.find((p) => p.type === 'reasoning') as
    | { type: 'reasoning'; text: string }
    | undefined

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-secondary px-4 py-2.5 text-secondary-foreground text-sm leading-relaxed">
          {text}
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
          {message.agent ?? 'assistant'}
        </span>
        {message.fromTaskId && (
          <Badge variant="secondary" className="text-[10px]">
            from task
          </Badge>
        )}
        <span className="text-muted-foreground/60 tabular-nums">
          {clockTime(message.createdAt)}
        </span>
      </div>
      {reasoning && (
        <Collapsible open={reasoningOpen} onOpenChange={setReasoningOpen}>
          <CollapsibleTrigger className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground">
            <ChevronDownIcon
              className={cn(
                'size-3 transition-transform',
                reasoningOpen && 'rotate-180',
              )}
            />
            Reasoning
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 rounded-md border-muted border-l-2 bg-muted/30 px-3 py-2 text-muted-foreground text-xs leading-relaxed">
            <div className="whitespace-pre-wrap">{reasoning.text}</div>
          </CollapsibleContent>
        </Collapsible>
      )}
      <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
        {text}
      </div>
    </div>
  )
}
