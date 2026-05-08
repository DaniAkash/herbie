import { useNavigate } from '@tanstack/react-router'
import { SparklesIcon } from 'lucide-react'
import { useMemo } from 'react'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { Composer } from '@/components/chat/Composer'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import type { AgentId, Message } from '@/modules/data/herbie-data.types'
import { clockTime } from '@/modules/utils/relativeTime'

type ChatProps = {
  conversationId: string | 'new'
}

export function Chat({ conversationId }: ChatProps) {
  const navigate = useNavigate()
  const {
    conversations,
    messages,
    workspaces,
    defaultAgent,
    createConversation,
    appendMessage,
    setConversationAgent,
    setConversationWorkspace,
  } = useHerbieData()

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

  const workspaceLabel = activeWorkspace
    ? `in ${workspaces.find((w) => w.id === activeWorkspace)?.name ?? activeWorkspace}`
    : 'no workspace'

  if (isNew) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="flex max-w-xl flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <SparklesIcon className="h-6 w-6" />
            </div>
            <h2 className="font-semibold text-2xl tracking-tight">
              What's on your mind?
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Start a chat with your agents. Pick a workspace if you want them
              to work on a specific project.
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
      <ChatHeader
        title={conversation.title}
        agent={activeAgent}
        workspaceLabel={workspaceLabel}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-6">
          {conversationMessages.map((m) => (
            <MessageBubble key={m.id} message={m} />
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

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const text = message.parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('\n\n')
  const reasoning = message.parts.find((p) => p.type === 'reasoning') as
    | { type: 'reasoning'; text: string }
    | undefined

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {isUser ? 'You' : (message.agent ?? 'assistant')}
        </span>
        {message.fromTaskId && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-[10px] text-primary">
            from task
          </span>
        )}
        <span className="text-muted-foreground text-xs">
          {clockTime(message.createdAt)}
        </span>
      </div>
      {reasoning && (
        <details className="rounded-md bg-muted/50 px-3 py-2 text-muted-foreground text-xs">
          <summary className="cursor-pointer font-medium">Reasoning</summary>
          <p className="mt-1.5 whitespace-pre-wrap">{reasoning.text}</p>
        </details>
      )}
      <div
        className={
          isUser
            ? 'self-start whitespace-pre-wrap rounded-2xl bg-secondary px-4 py-2.5 text-secondary-foreground text-sm'
            : 'self-start whitespace-pre-wrap text-sm leading-relaxed'
        }
      >
        {text}
      </div>
    </div>
  )
}
