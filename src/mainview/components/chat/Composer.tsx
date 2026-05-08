import { ArrowUpIcon, ClockIcon } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import type { AgentId } from '@/modules/data/herbie-data.types'
import { AgentPicker } from './AgentPicker'
import { WorkspacePicker } from './WorkspacePicker'

export type ComposerProps = {
  agent: AgentId
  workspaceId: string | undefined
  onAgentChange: (agent: AgentId) => void
  onWorkspaceChange: (id: string | undefined) => void
  onSubmit: (text: string) => void
  onSchedule?: (text: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function Composer({
  agent,
  workspaceId,
  onAgentChange,
  onWorkspaceChange,
  onSubmit,
  onSchedule,
  placeholder = 'Type a message…',
  autoFocus,
}: ComposerProps) {
  const [text, setText] = useState('')
  const trimmed = text.trim()

  function send() {
    if (!trimmed) return
    onSubmit(trimmed)
    setText('')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    send()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function handleSchedule() {
    if (!trimmed) return
    onSchedule?.(trimmed)
    setText('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gradient-to-t from-background via-background to-background/0 px-6 pt-6 pb-5"
    >
      <div className="mx-auto max-w-3xl">
        <InputGroup>
          <InputGroupTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            rows={2}
          />
          <InputGroupAddon align="block-end" className="gap-2">
            <AgentPicker value={agent} onChange={onAgentChange} />
            <WorkspacePicker value={workspaceId} onChange={onWorkspaceChange} />
            <div className="flex-1" />
            {onSchedule && (
              <InputGroupButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSchedule}
                disabled={!trimmed}
                title="Schedule this prompt instead of sending"
              >
                <ClockIcon data-icon="inline-start" />
                Schedule
              </InputGroupButton>
            )}
            <Button type="submit" size="icon-sm" disabled={!trimmed}>
              <ArrowUpIcon />
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
