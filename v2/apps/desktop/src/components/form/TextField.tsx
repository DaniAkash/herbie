import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from 'motion/react'
import {
  type InputHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { Input as InputBase } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface TextFieldProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'defaultValue' | 'onChange'
  > {
  label?: string
  value?: string
  defaultValue?: string
  /** The value, not the event: every call site wants the string. */
  onChange?: (value: string) => void
  /** Truthy shakes the field and reddens it; a string also shows a message. */
  error?: string | boolean
}

/**
 * A text field with its label and its validation message.
 *
 * The shadcn input is the field itself and accepts neither, so this carries
 * the two around it. `className` lands on the wrapper, as every call site
 * expects.
 */
export function TextField({
  label,
  value: valueProp,
  defaultValue,
  onChange,
  error,
  className,
  disabled,
  id: idProp,
  type,
  ...rest
}: TextFieldProps) {
  const reactId = useId()
  const id = idProp ?? reactId
  const reduce = useReducedMotion()
  const fieldRef = useRef<HTMLInputElement>(null)

  const controlled = valueProp !== undefined
  const [internal, setInternal] = useState(defaultValue ?? '')
  const value = controlled ? (valueProp ?? '') : internal

  const hasError = Boolean(error)
  const errorMessage = typeof error === 'string' ? error : null

  useEffect(() => {
    if (!fieldRef.current || reduce || !hasError) return
    animate(
      fieldRef.current,
      { x: [0, -6, 6, -4, 4, -2, 0] },
      { duration: 0.45 },
    )
  }, [hasError, reduce])

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <Label htmlFor={id} className="px-1 font-medium text-ink text-sm">
          {label}
        </Label>
      ) : null}

      <InputBase
        ref={fieldRef}
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        aria-describedby={errorMessage ? `${id}-error` : undefined}
        {...rest}
        onChange={(event) => {
          if (!controlled) setInternal(event.target.value)
          onChange?.(event.target.value)
        }}
        className={cn(
          'h-11 rounded-full border-line px-3.5 placeholder:text-ink-3/60',
          'focus-visible:border-ink/40 focus-visible:ring-2 focus-visible:ring-ring/40',
          disabled && 'opacity-60',
        )}
      />

      <AnimatePresence initial={false}>
        {errorMessage ? (
          <motion.p
            id={`${id}-error`}
            role="alert"
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, y: -4, filter: 'blur(4px)' }
            }
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, y: -4, filter: 'blur(4px)' }
            }
            transition={{ duration: 0.2 }}
            className="px-1 text-[12px] text-red"
          >
            {errorMessage}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
