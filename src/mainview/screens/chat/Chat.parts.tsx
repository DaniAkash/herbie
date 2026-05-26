import { useState } from 'react'
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
import { PermissionApprovalCard } from '@/components/chat/PermissionApprovalCard'
import { Badge } from '@/components/ui/badge'
import {
  attachmentBlobUrl,
  useAttachment,
} from '@/modules/api/attachments.hooks'
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
  'permission',
]

export function ChatMessageRow({
  message,
  agent,
  conversationId,
  partKinds = DEFAULT_PART_KINDS,
}: {
  message: ChatMessage
  agent: AgentId
  // Passed through to permission cards so they know which conv to
  // POST decisions to. Task runs leave it undefined; tasks force
  // read-only at runtime and never render pending cards anyway.
  conversationId?: string
  partKinds?: ReadonlyArray<MessagePart['kind']>
}) {
  if (message.role === 'user') {
    const text = message.parts
      .filter((p): p is TextPart => p.kind === 'text')
      .map((p) => p.text)
      .join('\n')
    return (
      <Message from="user">
        <div className="flex flex-col items-end gap-2">
          {message.attachmentIds && message.attachmentIds.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {message.attachmentIds.map((id) => (
                <UserAttachmentChip key={id} attachmentId={id} />
              ))}
            </div>
          )}
          <MessageContent>
            <span className="whitespace-pre-wrap text-sm leading-relaxed">
              {text}
            </span>
          </MessageContent>
        </div>
        <span className="px-2 text-[10px] text-muted-foreground/60 tabular-nums">
          {clockTime(message.createdAt)}
        </span>
      </Message>
    )
  }

  const allowed = new Set(partKinds)
  const visibleParts = message.parts.filter((p) => allowed.has(p.kind))

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
          <PartView
            key={part.id}
            part={part}
            streaming={message.isStreaming}
            conversationId={conversationId}
          />
        ))}
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
  conversationId,
}: {
  part: MessagePart
  streaming: boolean
  conversationId?: string
}) {
  if (part.kind === 'text') return <TextPartView part={part} />
  if (part.kind === 'reasoning')
    return <ReasoningPartView part={part} streaming={streaming} />
  if (part.kind === 'permission') {
    // Without a conversationId the card has no PATCH target. That
    // happens in task-run views where permission events shouldn't
    // appear in the first place; render nothing rather than a broken
    // pending card.
    if (!conversationId) return null
    return (
      <PermissionApprovalCard conversationId={conversationId} part={part} />
    )
  }
  return <ToolPartView part={part} messageIsStreaming={streaming} />
}

function TextPartView({ part }: { part: TextPart }) {
  return (
    <MessageContent>
      <MessageResponse>{part.text}</MessageResponse>
    </MessageContent>
  )
}

function UserAttachmentChip({ attachmentId }: { attachmentId: string }) {
  const { data } = useAttachment({ variables: { id: attachmentId } })
  if (!data) return null
  const isImage = data.mimeType.startsWith('image/')
  // Backend serializes a relative URL (`/attachments/<id>/blob`) which only
  // resolves correctly inside Bun-side fetches. The renderer lives on a
  // different host (views:// in prod, vite dev server otherwise), so the
  // <img> src must be absolutised against API_BASE_URL via this helper.
  if (isImage) {
    return (
      <img
        src={attachmentBlobUrl(attachmentId)}
        alt={data.filename}
        className="max-h-40 max-w-xs rounded-md border object-cover"
      />
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs">
      <span className="max-w-[200px] truncate font-medium">
        {data.filename}
      </span>
      <span className="text-muted-foreground tabular-nums">
        {formatBytes(data.sizeBytes)}
      </span>
    </div>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  return `${(n / (1024 * 1024)).toFixed(1)}MB`
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

function ToolPartView({
  part,
  messageIsStreaming,
}: {
  part: ToolPart
  messageIsStreaming: boolean
}) {
  // `autoOpen` is pure derived state: a tool block is open exactly when
  // it's the currently-active tool of a streaming turn. Anchoring on
  // messageIsStreaming (not just the part's own state) handles the
  // stuck-in-input-available case — if a tool.result event is dropped
  // by the bridge or the turn ends with a cancel/error, the tool's
  // state never moves to output-available, but the message stops
  // streaming, so autoOpen still flips to false and the block closes.
  //
  // userOverride is null until the user clicks the trigger. Once set,
  // it sticks for this tool — clicking to inspect a completed tool
  // keeps it open even on the next render, and closing a still-active
  // tool keeps it closed.
  const isActive =
    part.state === 'input-streaming' || part.state === 'input-available'
  const autoOpen = isActive && messageIsStreaming
  const [userOverride, setUserOverride] = useState<boolean | null>(null)
  const open = userOverride ?? autoOpen

  const inputValue = tryParseJson(part.input)
  const outputValue =
    part.output === null ? undefined : tryParseJson(part.output)

  return (
    <Tool open={open} onOpenChange={setUserOverride}>
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
