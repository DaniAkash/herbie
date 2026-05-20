import { Field, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'

export type BotKind = 'remote_control' | 'special_purpose'

// Two-option radio for the bot kind. Remote Control is disabled with
// an explainer when one already exists — the server enforces the
// at-most-one rule too, but surfacing it here saves a round trip and
// a confusing 409.
export function BotKindPicker({
  value,
  onChange,
  remoteControlTaken,
}: {
  value: BotKind
  onChange: (next: BotKind) => void
  remoteControlTaken: boolean
}) {
  return (
    <Field>
      <FieldLabel>Bot type</FieldLabel>
      <div className="flex flex-col gap-2">
        <BotKindOption
          checked={value === 'special_purpose'}
          onSelect={() => onChange('special_purpose')}
          title="Special Purpose"
          description="Dedicated bot for a single conversation. You can have as many of these as you need — one per project."
        />
        <BotKindOption
          checked={value === 'remote_control'}
          onSelect={() =>
            remoteControlTaken ? undefined : onChange('remote_control')
          }
          disabled={remoteControlTaken}
          title="Remote Control"
          description={
            remoteControlTaken
              ? 'You already have one Remote Control bot. Delete it first to add another.'
              : 'Manage many conversations from one bot — /new, /list, /switch, /archive. Limit: one per user.'
          }
        />
      </div>
    </Field>
  )
}

function BotKindOption({
  checked,
  onSelect,
  disabled,
  title,
  description,
}: {
  checked: boolean
  onSelect: () => void
  disabled?: boolean
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={checked}
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-foreground/30',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-1 inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-primary' : 'border-muted-foreground/40',
        )}
      >
        {checked && <span className="size-1.5 rounded-full bg-primary" />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-sm">{title}</span>
        <span className="text-muted-foreground text-xs leading-snug">
          {description}
        </span>
      </span>
    </button>
  )
}
