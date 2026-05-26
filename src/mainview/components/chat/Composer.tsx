import { ArrowUpIcon, PaperclipIcon, StopCircleIcon } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { useAgentCapabilities } from '@/modules/api/agents.hooks'
import { AgentPicker } from './AgentPicker'
import { AttachmentChip } from './AttachmentChip'
import { BelowComposerRow } from './Composer.below-row'
import type { ComposerSubmitAttachments } from './Composer.staging'
import { useComposerStaging } from './Composer.staging-hook'
import type { ComposerTuple } from './composer.types'
import { ModelPicker } from './ModelPicker'
import { ReasoningPicker } from './ReasoningPicker'
import { SwitchWarning } from './SwitchWarning'
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
  /** When set, attachment uploads bind directly to this conversation
   *  (existing chat). When undefined, files are buffered client-side
   *  and the parent orchestrates create-conv → upload → send on the
   *  first submit (new chat). */
  conversationId?: string
  onTupleChange: (next: ComposerTuple) => void
  onSubmit: (text: string, attachments: ComposerSubmitAttachments) => void
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const trimmed = text.trim()

  // Paperclip visibility is gated on the agent's probe-discovered caps.
  const { data: caps } = useAgentCapabilities({
    variables: { id: tuple.agentId },
  })
  const canAttach = caps?.promptCapabilities?.image ?? false

  const {
    staged,
    setStaged,
    upload,
    handleFiles,
    handleRemoveStaged,
    revokePendingUrls,
  } = useComposerStaging({ conversationId })

  function send() {
    if (!trimmed) return
    const uploadedIds: string[] = []
    const pendingFiles: File[] = []
    for (const item of staged) {
      if (item.kind === 'uploaded') uploadedIds.push(item.id)
      else pendingFiles.push(item.file)
    }
    onSubmit(trimmed, { uploadedIds, pendingFiles })
    setText('')
    revokePendingUrls()
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

  function patchTuple(patch: Partial<ComposerTuple>) {
    setWarningDismissed(false)
    onTupleChange({ ...tuple, ...patch })
  }

  // Mirror the bun-side providerKeyEqual (src/bun/chat/tuple.ts): the
  // warning only fires for changes that actually trigger Path A
  // (provider rebuild + transcript replay). Model and reasoning
  // changes take Path C — no replay, no banner.
  const wouldTriggerReplay =
    !!initialTuple &&
    (tuple.agentId !== initialTuple.agentId ||
      tuple.workspacePath !== initialTuple.workspacePath)
  const showSwitchWarning =
    hasPriorTurns && wouldTriggerReplay && !warningDismissed && !isStreaming

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gradient-to-t from-background via-background to-background/0 px-6 pt-6 pb-5"
    >
      <div className="mx-auto max-w-3xl">
        {showSwitchWarning && initialTuple && (
          // Undo reverts to the user's landing tuple — including any
          // model / reasoning fields the agent change cascaded to null
          // — and flows through onTupleChange so the parent's eager
          // PATCH wrapper persists the revert.
          <SwitchWarning
            onUndo={() => onTupleChange(initialTuple)}
            onDismiss={() => setWarningDismissed(true)}
          />
        )}
        {staged.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {staged.map((item) => {
              const key = item.kind === 'uploaded' ? item.id : item.localId
              return (
                <AttachmentChip
                  key={key}
                  filename={item.filename}
                  blobUrl={item.blobUrl}
                  onRemove={() => handleRemoveStaged(key)}
                />
              )
            })}
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
          accept="image/*"
          className="hidden"
          onChange={handleFiles}
        />
        <BelowComposerRow
          tuple={tuple}
          isStreaming={isStreaming}
          trimmed={trimmed}
          conversationId={conversationId}
          onPermissionModeChange={(permissionMode) =>
            patchTuple({ permissionMode })
          }
          onSchedule={
            onSchedule
              ? (t) => {
                  onSchedule(t)
                  setText('')
                }
              : undefined
          }
        />
      </div>
    </form>
  )
}
