import { ClockIcon, SendHorizonalIcon } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { AgentId } from '@/modules/data/herbie-data.types'
import { AgentPicker } from './AgentPicker'
import { WorkspacePicker } from './WorkspacePicker'

type ComposerProps = {
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

  function send() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setText('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    send()
  }

  function handleSchedule() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSchedule?.(trimmed)
    setText('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border border-t bg-background px-6 py-4"
    >
      <div className="rounded-2xl border border-border bg-card shadow-sm transition-shadow focus-within:shadow-md">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          autoFocus={autoFocus}
          className="min-h-[3.5rem] resize-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center gap-2 border-border/60 border-t px-3 py-2">
          <AgentPicker value={agent} onChange={onAgentChange} />
          <WorkspacePicker value={workspaceId} onChange={onWorkspaceChange} />
          <div className="flex-1" />
          {onSchedule && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handleSchedule}
              disabled={!text.trim()}
            >
              <ClockIcon className="h-3.5 w-3.5" />
              Schedule
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            className="h-7 gap-1.5"
            disabled={!text.trim()}
          >
            <SendHorizonalIcon className="h-3.5 w-3.5" />
            Send
          </Button>
        </div>
      </div>
      <p className="mt-2 px-2 text-[11px] text-muted-foreground">
        Enter to send · Shift+Enter for newline
      </p>
    </form>
  )
}
