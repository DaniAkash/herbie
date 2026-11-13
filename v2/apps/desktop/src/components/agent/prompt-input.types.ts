import type { ReactNode, TextareaHTMLAttributes } from 'react'

export interface PromptModel {
  value: string
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

export interface PromptAction {
  value: string
  label: ReactNode
  description?: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

export interface PromptInputProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'value' | 'defaultValue' | 'onChange' | 'onSubmit' | 'children'
  > {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  models?: PromptModel[]
  model?: string
  defaultModel?: string
  onModelChange?: (model: string) => void
  actions?: PromptAction[]
  onAction?: (action: string) => void
  onSubmit?: (value: string, model?: string) => void | Promise<void>
  loading?: boolean
  onStop?: () => void
  minRows?: number
  maxRows?: number
  leadingAction?: ReactNode
  className?: string
}
