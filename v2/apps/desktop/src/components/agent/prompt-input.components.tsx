import { ArrowUp, Plus, Square } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { SPRING_SWAP } from '@/lib/ease'
import type { PromptAction, PromptModel } from './prompt-input.types'

interface PromptActionsMenuProps {
  actions: PromptAction[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction?: (action: string) => void
  disabled?: boolean
}

export function PromptActionsMenu({
  actions,
  open,
  onOpenChange,
  onAction,
  disabled,
}: PromptActionsMenuProps) {
  const reduce = useReducedMotion() ?? false

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="Add to prompt"
            className="size-8 rounded-full"
          />
        }
      >
        <motion.span
          aria-hidden="true"
          animate={{ rotate: open ? 45 : 0 }}
          transition={reduce ? { duration: 0 } : SPRING_SWAP}
        >
          <Plus className="size-4" />
        </motion.span>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-56 gap-0 rounded-xl border border-line bg-page p-1.5 shadow-overlay ring-0"
      >
        {actions.map((action) => (
          <button
            key={action.value}
            type="button"
            disabled={action.disabled}
            onClick={() => {
              onAction?.(action.value)
              onOpenChange(false)
            }}
            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-hover focus-visible:bg-hover disabled:pointer-events-none disabled:opacity-50"
          >
            {action.icon ? (
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center text-ink-3 [&_svg]:size-4">
                {action.icon}
              </span>
            ) : null}
            <span className="min-w-0">
              <span className="block text-ink text-sm">{action.label}</span>
              {action.description ? (
                <span className="mt-0.5 block text-[12px] text-ink-3 leading-4">
                  {action.description}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

interface PromptModelSelectProps {
  models: PromptModel[]
  value?: string
  onValueChange: (value: string) => void
  disabled?: boolean
}

export function PromptModelSelect({
  models,
  value,
  onValueChange,
  disabled,
}: PromptModelSelectProps) {
  const current = models.find((option) => option.value === value)

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next != null) onValueChange(next)
      }}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 w-auto min-w-0 max-w-52 rounded-xl border-0 bg-transparent px-2 py-0 text-[12px] hover:bg-hover focus-visible:ring-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {current?.icon ? (
            <span className="grid size-4 shrink-0 place-items-center text-ink-3 [&_svg]:size-3.5">
              {current.icon}
            </span>
          ) : null}
          <span className="truncate text-ink-3">
            {current?.label ?? 'Choose model'}
          </span>
        </span>
      </SelectTrigger>
      <SelectContent className="right-auto w-52 shadow-none">
        {models.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="py-2"
          >
            <span className="flex min-w-0 items-center gap-2">
              {option.icon ? (
                <span className="grid size-5 shrink-0 place-items-center text-ink-3 [&_svg]:size-4">
                  {option.icon}
                </span>
              ) : null}
              <span className="min-w-0 truncate text-ink text-sm">
                {option.label}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface PromptSendButtonProps {
  loading: boolean
  canSubmit: boolean
  onStop?: () => void
}

export function PromptSendButton({
  loading,
  canSubmit,
  onStop,
}: PromptSendButtonProps) {
  const reduce = useReducedMotion() ?? false

  return (
    <Button
      type={loading ? 'button' : 'submit'}
      size="icon"
      disabled={loading ? !onStop : !canSubmit}
      aria-label={loading ? 'Stop generating' : 'Send prompt'}
      onClick={loading ? onStop : undefined}
      className="ml-auto size-8 rounded-full"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={loading ? 'stop' : 'send'}
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 3, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.8 }}
          transition={reduce ? { duration: 0 } : SPRING_SWAP}
          className="grid place-items-center"
        >
          {loading ? (
            <Square className="size-3 fill-current" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}
