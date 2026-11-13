import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  PromptActionsMenu,
  PromptModelSelect,
  PromptSendButton,
} from './prompt-input.components'
import { useAutoGrowTextarea } from './prompt-input.hooks'
import type { PromptInputProps } from './prompt-input.types'

export function PromptInput({
  value,
  defaultValue = '',
  onValueChange,
  models = [],
  model,
  defaultModel,
  onModelChange,
  actions = [],
  onAction,
  onSubmit,
  loading = false,
  onStop,
  minRows = 2,
  maxRows = 8,
  leadingAction,
  className,
  disabled,
  placeholder = 'Ask the agent to do something…',
  'aria-label': ariaLabel = 'Prompt',
  onKeyDown,
  ...textareaProps
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const measurementRef = useRef<HTMLDivElement>(null)
  const [internalValue, setInternalValue] = useState(defaultValue)
  const [internalModel, setInternalModel] = useState(
    defaultModel ?? models[0]?.value,
  )
  const [actionsOpen, setActionsOpen] = useState(false)
  const currentValue = value ?? internalValue
  const currentModelValue = model ?? internalModel
  const canSubmit = Boolean(currentValue.trim()) && !disabled && !loading

  useAutoGrowTextarea({
    textareaRef,
    measurementRef,
    value: currentValue,
    minRows,
    maxRows,
  })

  const setValue = (next: string) => {
    if (value === undefined) setInternalValue(next)
    onValueChange?.(next)
  }

  const setModel = (next: string) => {
    if (model === undefined) setInternalModel(next)
    onModelChange?.(next)
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const prompt = currentValue.trim()
    if (!prompt || disabled || loading) return

    onSubmit?.(prompt, currentModelValue)
    if (value === undefined) setInternalValue('')
    textareaRef.current?.focus({ preventScroll: true })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event)
    if (
      event.defaultPrevented ||
      event.key !== 'Enter' ||
      event.shiftKey ||
      // An IME candidate window takes Enter to accept the candidate, so a
      // composing Enter is never a send.
      event.nativeEvent.isComposing
    ) {
      return
    }
    event.preventDefault()
    submit()
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        'relative w-full rounded-2xl border border-line/80 bg-page p-2 transition-colors focus-within:border-ink/25',
        disabled && 'opacity-60',
        className,
      )}
    >
      <div
        ref={measurementRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-2 top-0 whitespace-pre-wrap px-2 text-sm leading-6 [overflow-wrap:break-word]"
      >
        {`${currentValue}​`}
      </div>
      <textarea
        ref={textareaRef}
        value={currentValue}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={minRows}
        {...textareaProps}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        className="scrollbar-hide block w-full resize-none overflow-y-auto bg-transparent px-2 pt-1.5 text-ink text-sm leading-6 outline-none placeholder:text-ink-3/55"
      />

      <div className="mt-1 flex min-h-8 items-center gap-1">
        {actions.length ? (
          <PromptActionsMenu
            actions={actions}
            open={actionsOpen}
            onOpenChange={setActionsOpen}
            onAction={onAction}
            disabled={disabled || loading}
          />
        ) : null}
        {leadingAction}
        {models.length ? (
          <PromptModelSelect
            models={models}
            value={currentModelValue}
            onValueChange={setModel}
            disabled={disabled || loading}
          />
        ) : null}
        <PromptSendButton
          loading={loading}
          canSubmit={canSubmit}
          onStop={onStop}
        />
      </div>
    </form>
  )
}
