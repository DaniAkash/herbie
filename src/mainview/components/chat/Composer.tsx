import {
  ArrowUpIcon,
  ClockIcon,
  FileIcon,
  ImageIcon,
  Music2Icon,
  PaperclipIcon,
  StopCircleIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react'
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { useAgentCapabilities } from '@/modules/api/agents.hooks'
import {
  useDeleteAttachment,
  useUploadAttachment,
} from '@/modules/api/attachments.hooks'
import { AgentPicker } from './AgentPicker'
import { type ComposerTuple, tuplesEqual } from './composer.types'
import { ModelPicker } from './ModelPicker'
import { ReasoningPicker } from './ReasoningPicker'
import { WorkspacePicker } from './WorkspacePicker'

interface StagedAttachment {
  id: string
  filename: string
  mimeType: string
  blobUrl: string
}

export interface ComposerProps {
  tuple: ComposerTuple
  /** Tuple at the time the composer mounted; used to detect mid-conversation
   *  switches and surface the warning banner. New chats pass undefined. */
  initialTuple?: ComposerTuple
  /** Whether the conversation already has prior turns. The switch warning
   *  only matters once the first turn is committed. */
  hasPriorTurns?: boolean
  isStreaming?: boolean
  /** When set, the paperclip is wired and uploads attach to this
   *  conversation. New-chat composers leave it undefined; attachments
   *  for the first turn are a follow-up. */
  conversationId?: string
  onTupleChange: (next: ComposerTuple) => void
  onSubmit: (text: string, attachmentIds: string[]) => void
  onCancel?: () => void
  onSchedule?: (text: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function Composer({
  tuple,
  initialTuple,
  hasPriorTurns,
  isStreaming = false,
  conversationId,
  onTupleChange,
  onSubmit,
  onCancel,
  onSchedule,
  placeholder = 'Type a message…',
  autoFocus,
}: ComposerProps) {
  const [text, setText] = useState('')
  const [warningDismissed, setWarningDismissed] = useState(false)
  const [staged, setStaged] = useState<StagedAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const trimmed = text.trim()

  // Drives the paperclip's visibility — gated on the active agent's
  // probe-discovered prompt caps. New-chat composers (no conversationId
  // yet) keep the button hidden; uploads for the first turn are a
  // follow-up.
  const { data: caps } = useAgentCapabilities({
    variables: { id: tuple.agentId },
  })
  const canAttach =
    conversationId !== undefined &&
    (caps?.promptCapabilities?.image ||
      caps?.promptCapabilities?.audio ||
      caps?.promptCapabilities?.embeddedContext)

  const upload = useUploadAttachment()
  const remove = useDeleteAttachment()

  function send() {
    if (!trimmed) return
    onSubmit(
      trimmed,
      staged.map((a) => a.id),
    )
    setText('')
    setStaged([])
    setWarningDismissed(false)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isStreaming) {
      onCancel?.()
      return
    }
    send()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isStreaming) return
      send()
    }
  }

  function handleSchedule() {
    if (!trimmed) return
    onSchedule?.(trimmed)
    setText('')
  }

  function patchTuple(patch: Partial<ComposerTuple>) {
    setWarningDismissed(false)
    onTupleChange({ ...tuple, ...patch })
  }

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !conversationId) return
    for (const file of Array.from(files)) {
      try {
        const uploaded = await upload.mutateAsync({ conversationId, file })
        setStaged((prev) => [
          ...prev,
          {
            id: uploaded.id,
            filename: uploaded.filename,
            mimeType: uploaded.mimeType,
            blobUrl: uploaded.url,
          },
        ])
      } catch (err) {
        toast.error('Upload failed', { description: String(err) })
      }
    }
    // Reset so the same file can be re-picked after a remove.
    e.target.value = ''
  }

  function handleRemoveStaged(id: string) {
    setStaged((prev) => prev.filter((a) => a.id !== id))
    // Fire-and-forget — if the server delete fails the row just sits
    // there until the conv-delete cleanup picks it up.
    void remove.mutateAsync(id).catch(() => undefined)
  }

  const tupleChanged = !tuplesEqual(tuple, initialTuple)
  const showSwitchWarning =
    hasPriorTurns && tupleChanged && !warningDismissed && !isStreaming

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gradient-to-t from-background via-background to-background/0 px-6 pt-6 pb-5"
    >
      <div className="mx-auto max-w-3xl">
        {showSwitchWarning && (
          <SwitchWarning onDismiss={() => setWarningDismissed(true)} />
        )}
        {staged.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {staged.map((item) => (
              <AttachmentChip
                key={item.id}
                item={item}
                onRemove={() => handleRemoveStaged(item.id)}
              />
            ))}
          </div>
        )}
        <InputGroup>
          <InputGroupTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Agent is responding…' : placeholder}
            autoFocus={autoFocus}
            disabled={isStreaming}
            rows={2}
          />
          <InputGroupAddon align="block-end" className="flex-wrap gap-2">
            <AgentPicker
              value={tuple.agentId}
              onChange={(agentId) =>
                // Switching agent invalidates model + reasoning since
                // their valid value sets are agent-specific.
                patchTuple({ agentId, modelId: null, reasoningEffort: null })
              }
            />
            <ModelPicker
              agentId={tuple.agentId}
              value={tuple.modelId}
              onChange={(modelId) => patchTuple({ modelId })}
            />
            <WorkspacePicker
              value={tuple.workspacePath}
              onChange={(workspacePath) => patchTuple({ workspacePath })}
            />
            <ReasoningPicker
              agentId={tuple.agentId}
              value={tuple.reasoningEffort}
              onChange={(reasoningEffort) => patchTuple({ reasoningEffort })}
            />
            {canAttach && (
              <InputGroupButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming || upload.isPending}
                title="Attach a file"
              >
                <PaperclipIcon data-icon="inline-start" />
                Attach
              </InputGroupButton>
            )}
            <div className="flex-1" />
            {onSchedule && (
              <InputGroupButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSchedule}
                disabled={!trimmed || isStreaming}
                title="Schedule this prompt instead of sending"
              >
                <ClockIcon data-icon="inline-start" />
                Schedule
              </InputGroupButton>
            )}
            <Button
              type="submit"
              size="icon-sm"
              disabled={!isStreaming && !trimmed}
              aria-label={isStreaming ? 'Stop' : 'Send'}
            >
              {isStreaming ? <StopCircleIcon /> : <ArrowUpIcon />}
            </Button>
          </InputGroupAddon>
        </InputGroup>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
            ↵
          </kbd>{' '}
          send ·{' '}
          <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
            ⇧↵
          </kbd>{' '}
          new line
        </p>
      </div>
    </form>
  )
}

function AttachmentChip({
  item,
  onRemove,
}: {
  item: StagedAttachment
  onRemove: () => void
}) {
  const isImage = item.mimeType.startsWith('image/')
  const isAudio = item.mimeType.startsWith('audio/')
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 py-1 pr-1 pl-2 text-xs">
      {isImage ? (
        <img
          src={item.blobUrl}
          alt={item.filename}
          className="size-6 rounded object-cover"
        />
      ) : isAudio ? (
        <Music2Icon className="size-3.5 text-muted-foreground" />
      ) : item.mimeType === 'application/octet-stream' ? (
        <FileIcon className="size-3.5 text-muted-foreground" />
      ) : (
        <ImageIcon className="size-3.5 text-muted-foreground" />
      )}
      <span className="max-w-[180px] truncate font-medium">
        {item.filename}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.filename}`}
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  )
}

function SwitchWarning({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-700 text-xs dark:text-amber-400">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1 leading-relaxed">
        Switching agent / model / workspace replays the full conversation to the
        new context. The new agent's first response loses prompt cache and some
        context nuance.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss warning"
        className="text-amber-700/70 hover:text-amber-700 dark:text-amber-400/70 dark:hover:text-amber-400"
      >
        ✕
      </button>
    </div>
  )
}
