import {
  CheckIcon,
  ChevronDownIcon,
  EyeIcon,
  HandIcon,
  OctagonAlertIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { PermissionMode } from './composer.types'

interface Option {
  value: PermissionMode
  label: string
  description: string
  icon: typeof ShieldCheckIcon
  danger: boolean
}

// Render order matches the dropdown layout. Safe options first;
// `allow-all` last, after a separator (rendered conditionally), with
// amber styling on both icon and label so the chip in the composer
// reads as a "you sure?" choice when active. Matches the pattern
// Codex uses for its "Full access" mode.
const OPTIONS: readonly Option[] = [
  {
    value: 'auto-approve-reads',
    label: 'Auto-approve reads',
    description: 'Reads pass; writes & shell prompt you',
    icon: ShieldCheckIcon,
    danger: false,
  },
  {
    value: 'manual',
    label: 'Approve each request',
    description: 'Every gate prompts you',
    icon: HandIcon,
    danger: false,
  },
  {
    value: 'read-only',
    label: 'Read-only',
    description: 'Reads pass; writes & shell auto-denied',
    icon: EyeIcon,
    danger: false,
  },
  {
    value: 'allow-all',
    label: 'Allow everything',
    description: 'Agent runs unattended — use with care',
    icon: OctagonAlertIcon,
    danger: true,
  },
] as const

interface PermissionPickerProps {
  value: PermissionMode
  onChange: (mode: PermissionMode) => void
  disabled?: boolean
}

export function PermissionPicker({
  value,
  onChange,
  disabled,
}: PermissionPickerProps) {
  const active = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0]
  const ActiveIcon = active.icon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={<Button variant="ghost" size="sm" />}
      >
        <ActiveIcon
          data-icon="inline-start"
          className={cn(active.danger && 'text-amber-600 dark:text-amber-500')}
        />
        <span
          className={cn(active.danger && 'text-amber-600 dark:text-amber-500')}
        >
          {active.label}
        </span>
        <ChevronDownIcon data-icon="inline-end" className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {OPTIONS.map((opt, idx) => {
          const Icon = opt.icon
          const needsSeparator = opt.danger && idx > 0
          return (
            <div key={opt.value}>
              {needsSeparator && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={() => onChange(opt.value)}
                className={cn(
                  'flex items-start gap-2',
                  opt.danger &&
                    'text-amber-600 focus:text-amber-600 dark:text-amber-500 dark:focus:text-amber-500',
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0" />
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="font-medium text-xs">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {opt.description}
                  </span>
                </div>
                {value === opt.value && (
                  <CheckIcon className="mt-0.5 size-4 text-primary" />
                )}
              </DropdownMenuItem>
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
