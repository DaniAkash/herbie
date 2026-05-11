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
  TestError,
  TestErrorMessage,
  TestErrorStack,
} from '@/components/ai-elements/test-results'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
import { Badge } from '@/components/ui/badge'
import type { AgentId } from '@/modules/data/herbie-data.types'
import { clockTime } from '@/modules/utils/relativeTime'
import type {
  ChatMessage,
  MessagePart,
  ReasoningPart,
  TextPart,
  ToolPart,
} from './chat.types'

// `partKinds` filters which part kinds render. Chat passes all three
// (the default); task runs pass ['text'] only so tool calls and
// reasoning blocks don't clutter the run-result view. The user-message
// row is unaffected — user messages are text-only by construction.
const DEFAULT_PART_KINDS: ReadonlyArray<MessagePart['kind']> = [
  'text',
  'reasoning',
  'tool',
]

export function ChatMessageRow({
  message,
  agent,
  partKinds = DEFAULT_PART_KINDS,
}: {
  message: ChatMessage
  agent: AgentId
  partKinds?: ReadonlyArray<MessagePart['kind']>
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

  const allowed = new Set(partKinds)
  const visibleParts = message.parts.filter((p) => allowed.has(p.kind))
  const showThinking =
    message.isStreaming &&
    visibleParts.length === 0 &&
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
        {visibleParts.map((part) => (
          <PartView key={part.id} part={part} streaming={message.isStreaming} />
        ))}
        {showThinking && (
          <div className="text-muted-foreground text-sm italic">thinking…</div>
        )}
        {message.errorMessage && (
          <TestError>
            <TestErrorMessage>{message.errorMessage}</TestErrorMessage>
            {(message.errorCode || message.errorDetails) && (
              <TestErrorStack>
                {message.errorCode && (
                  <span className="opacity-70">{message.errorCode}: </span>
                )}
                {message.errorDetails ?? ''}
              </TestErrorStack>
            )}
          </TestError>
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
