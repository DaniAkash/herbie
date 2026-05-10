import {
  ArrowUpIcon,
  ClockIcon,
  StopCircleIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { AgentPicker } from './AgentPicker'
import { type ComposerTuple, tuplesEqual } from './composer.types'
import { ModelPicker } from './ModelPicker'
import { ReasoningPicker } from './ReasoningPicker'
import { WorkspacePicker } from './WorkspacePicker'

export interface ComposerProps {
  tuple: ComposerTuple
  /** Tuple at the time the composer mounted; used to detect mid-conversation
   *  switches and surface the warning banner. New chats pass undefined. */
  initialTuple?: ComposerTuple
  /** Whether the conversation already has prior turns. The switch warning
   *  only matters once the first turn is committed. */
  hasPriorTurns?: boolean
  isStreaming?: boolean
  onTupleChange: (next: ComposerTuple) => void
  onSubmit: (text: string) => void
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
  onTupleChange,
  onSubmit,
  onCancel,
  onSchedule,
  placeholder = 'Type a message…',
  autoFocus,
}: ComposerProps) {
  const [text, setText] = useState('')
  const [warningDismissed, setWarningDismissed] = useState(false)
  const trimmed = text.trim()

  function send() {
    if (!trimmed) return
    onSubmit(trimmed)
    setText('')
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
        className="text-amber-700/70 hover:text-amber-700 dark:text-amber-400/70 dark:hover:text-amber-400"
      >
        ✕
      </button>
    </div>
  )
}
