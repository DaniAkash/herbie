import { ClockIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ComposerTuple, PermissionMode } from './composer.types'
import { PermissionPicker } from './PermissionPicker'
import { SendToTelegramButton } from './SendToTelegramButton'

interface BelowComposerRowProps {
  tuple: ComposerTuple
  isStreaming: boolean
  trimmed: string
  conversationId?: string
  onPermissionModeChange: (mode: PermissionMode) => void
  onSchedule?: (text: string) => void
}

// Below-composer action row: actions on the conversation/prompt, not
// the message being composed. Quieter visual weight than the in-composer
// toolbar so the eye doesn't confuse them with sending controls.
export function BelowComposerRow({
  tuple,
  isStreaming,
  trimmed,
  conversationId,
  onPermissionModeChange,
  onSchedule,
}: BelowComposerRowProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 px-1">
      <PermissionPicker
        value={tuple.permissionMode}
        onChange={onPermissionModeChange}
        disabled={isStreaming}
      />
      {onSchedule && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => trimmed && onSchedule(trimmed)}
          disabled={!trimmed || isStreaming}
          title="Schedule this prompt instead of sending"
        >
          <ClockIcon data-icon="inline-start" />
          Schedule
        </Button>
      )}
      {conversationId && (
        <SendToTelegramButton
          conversationId={conversationId}
          disabled={isStreaming}
        />
      )}
      <div className="flex-1" />
      <p className="text-[11px] text-muted-foreground">
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
  )
}
