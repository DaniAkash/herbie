import { useNavigate } from '@tanstack/react-router'
import { SparklesIcon } from 'lucide-react'
import { useState } from 'react'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
import { Composer } from '@/components/chat/Composer'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateConversation } from '@/modules/api/chat.hooks'
import { useDefaultAgent } from '@/modules/api/settings.hooks'
import type { AgentId } from '@/modules/data/herbie-data.types'
import { clockTime } from '@/modules/utils/relativeTime'
import { useChatData } from './chat.data'
import { useSendMessage } from './chat.hooks'
import type {
  ChatMessage,
  MessagePart,
  ReasoningPart,
  TextPart,
  ToolPart,
} from './chat.types'

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
  // Agent stays derived from the saved default until the user explicitly
  // picks one — that way the settings query resolving after first paint
  // doesn't leave us frozen on the fallback.
  const [pickedAgent, setPickedAgent] = useState<AgentId | null>(null)
  const agent = pickedAgent ?? defaultAgent
  const [workspaceId, setWorkspaceId] = useState<string | undefined>()

  const createMutation = useCreateConversation()
  const sendMutation = useSendMessage()

  async function handleSubmit(text: string) {
    const conv = await createMutation.mutateAsync({
      agentId: agent,
      title: text.slice(0, 60),
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
        onAgentChange={setPickedAgent}
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
  const workspaceId: string | undefined = undefined

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
        </div>
      </PageHeader>
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl 2xl:max-w-4xl">
          {data.messages.map((m) => (
            <ChatMessageRow key={m.id} message={m} agent={agent} />
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <Composer
        agent={agent}
        workspaceId={workspaceId}
        // Agent + workspace are baked into the ACP session; mid-conversation
        // changes would require a fresh session. Lock the pickers so the UI
        // doesn't suggest otherwise.
        onAgentChange={() => {}}
        onWorkspaceChange={() => {}}
        onSubmit={handleSubmit}
        onSchedule={handleSchedule}
        pickersReadOnly
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
    const text = message.parts
      .filter((p): p is TextPart => p.kind === 'text')
      .map((p) => p.text)
      .join('\n')
    return (
      <Message from="user">
        <MessageContent>
          <span className="whitespace-pre-wrap text-sm leading-relaxed">
            {text}
          </span>
        </MessageContent>
        <span className="px-2 text-[10px] text-muted-foreground/60 tabular-nums">
          {clockTime(message.createdAt)}
        </span>
      </Message>
    )
  }

  const showThinking =
    message.isStreaming &&
    message.parts.length === 0 &&
    !message.isCancelled &&
    !message.isError

  return (
    <Message from="assistant">
      <div className="flex w-full flex-col gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-muted-foreground uppercase tracking-wider">
            {message.agent ?? agent}
          </span>
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
        {message.parts.map((part) => (
          <PartView key={part.id} part={part} streaming={message.isStreaming} />
        ))}
        {showThinking && (
          <div className="text-muted-foreground text-sm italic">thinking…</div>
        )}
        {message.errorMessage && (
          <div className="rounded border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-xs">
            {message.errorMessage}
          </div>
        )}
      </div>
    </Message>
  )
}

function PartView({
  part,
  streaming,
}: {
  part: MessagePart
  streaming: boolean
}) {
  if (part.kind === 'text') return <TextPartView part={part} />
  if (part.kind === 'reasoning')
    return <ReasoningPartView part={part} streaming={streaming} />
  return <ToolPartView part={part} />
}

function TextPartView({ part }: { part: TextPart }) {
  return (
    <MessageContent>
      <MessageResponse>{part.text}</MessageResponse>
    </MessageContent>
  )
}

function ReasoningPartView({
  part,
  streaming,
}: {
  part: ReasoningPart
  streaming: boolean
}) {
  // Plan blocks render as reasoning with a "Plan" badge for now. The
  // dedicated Plan AI Element has an upstream type mismatch between
  // base-ui's Collapsible and Button — revisit when that lands.
  return (
    <Reasoning defaultOpen={part.isOpen} isStreaming={part.isOpen && streaming}>
      <div className="flex items-center gap-2">
        <ReasoningTrigger />
        {part.isPlan && (
          <Badge variant="secondary" className="text-[10px]">
            plan
          </Badge>
        )}
      </div>
      <ReasoningContent>{part.text}</ReasoningContent>
    </Reasoning>
  )
}

function ToolPartView({ part }: { part: ToolPart }) {
  const open = part.state === 'input-streaming' || part.isError
  const inputValue = tryParseJson(part.input)
  const outputValue =
    part.output === null ? undefined : tryParseJson(part.output)

  return (
    <Tool defaultOpen={open}>
      <ToolHeader
        type="dynamic-tool"
        toolName={part.toolName}
        state={part.state}
      />
      <ToolContent>
        {/* ToolInput JSON-stringifies its input, which mangles raw strings
            with escaped quotes. Render plain text inline; only feed JSON
            shapes to ToolInput. */}
        {typeof inputValue === 'string' ? (
          <PlainParameters text={inputValue} />
        ) : (
          <ToolInput input={inputValue} />
        )}
        <ToolOutput
          output={outputValue ?? null}
          errorText={part.isError ? (part.errorMessage ?? 'error') : undefined}
        />
      </ToolContent>
    </Tool>
  )
}

function PlainParameters({ text }: { text: string }) {
  if (!text) return null
  return (
    <div className="space-y-2 overflow-hidden">
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Parameters
      </h4>
      <pre className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 font-mono text-xs">
        {text}
      </pre>
    </div>
  )
}

function tryParseJson(text: string): unknown {
  if (!text) return text
  const trimmed = text.trim()
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
    return text
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    return text
  }
}
