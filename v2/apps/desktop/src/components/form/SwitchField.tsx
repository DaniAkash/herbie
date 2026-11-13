import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

export interface SwitchFieldProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  ariaLabel?: string
  className?: string
}

/**
 * A switch with the name it answers to.
 *
 * Every switch in the app sits in a panel row whose text is the label, so the
 * name is usually given to assistive tech only. The shadcn switch takes
 * neither form, which is what this carries.
 */
export function SwitchField({
  checked,
  onCheckedChange,
  disabled,
  label,
  ariaLabel,
  className,
}: SwitchFieldProps) {
  const id = useId()

  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <Switch
        id={id}
        size="lg"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={ariaLabel}
        className="data-unchecked:bg-ink-3/60 dark:data-unchecked:bg-ink-3/60"
      />
      {label ? (
        <Label htmlFor={id} className="cursor-pointer text-ink text-sm">
          {label}
        </Label>
      ) : null}
    </span>
  )
}
