import { type HTMLMotionProps, motion, useReducedMotion } from 'motion/react'
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
} from 'react'
import { EASE_OUT, SPRING_LAYOUT } from '@/lib/ease'
import { cn } from '@/lib/utils'

export type MessageSide = 'start' | 'end'

/** Which side of the transcript a bubble is on, so a bubble inherits it. */
export const MessageSideContext = createContext<MessageSide | undefined>(
  undefined,
)

export type MessageBubbleVariant = 'soft' | 'tint' | 'danger'
export type MessageBubbleAlign = MessageSide

interface MessageBubbleContextValue {
  align?: MessageBubbleAlign
  animateIn: boolean
  variant: MessageBubbleVariant
}

const MessageBubbleContext = createContext<MessageBubbleContextValue>({
  animateIn: true,
  variant: 'soft',
})

export interface MessageBubbleProps
  extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: MessageBubbleVariant
  /** Defaults to the surrounding side when omitted. */
  align?: MessageBubbleAlign
  /** Plays the bubble entrance once when this component mounts. */
  animateIn?: boolean
  children?: ReactNode
}

export type MessageBubbleContentProps = ComponentPropsWithRef<'div'>

const BUBBLE_CONTENT_REVEAL = {
  duration: 0.12,
  ease: EASE_OUT,
  delay: 0.04,
} as const

/** One restrained overshoot, so a sent bubble pops rather than drifts in. */
const BUBBLE_POP = {
  type: 'spring',
  stiffness: 520,
  damping: 27,
  mass: 0.52,
} as const

export function MessageBubble({
  variant = 'soft',
  align,
  animateIn = false,
  className,
  children,
  initial,
  animate,
  exit,
  transition,
  layout,
  ...props
}: MessageBubbleProps) {
  const reduce = useReducedMotion() ?? false
  const messageSide = useContext(MessageSideContext)
  const resolvedAlign = align ?? messageSide ?? 'start'

  return (
    <MessageBubbleContext.Provider
      value={{ align: resolvedAlign, animateIn, variant }}
    >
      <motion.div
        data-slot="message-bubble"
        data-align={resolvedAlign}
        data-variant={variant}
        layout={layout}
        initial={initial ?? false}
        animate={animate}
        exit={
          exit ?? (reduce ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.99 })
        }
        transition={transition ?? (reduce ? { duration: 0.12 } : SPRING_LAYOUT)}
        className={cn(
          'group/bubble flex w-full flex-col',
          resolvedAlign === 'end' ? 'items-end' : 'items-start',
          className,
        )}
        {...props}
      >
        {children}
      </motion.div>
    </MessageBubbleContext.Provider>
  )
}

function bubbleContentClass(variant: MessageBubbleVariant) {
  return cn(
    'relative z-0 min-w-9 max-w-[82%] rounded-2xl px-3.5 py-2.5 text-ink text-sm leading-6',
    '[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-page/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-page/60 [&_pre]:p-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
    variant === 'danger' && 'text-red',
  )
}

/**
 * The surface sits on its own layer behind the text rather than on the content
 * element, so it can animate its size without the copy reflowing with it.
 */
function bubbleSurfaceClass(
  variant: MessageBubbleVariant,
  align: MessageBubbleAlign,
) {
  return cn(
    'pointer-events-none absolute inset-0 -z-10 rounded-[inherit]',
    align === 'end' ? 'origin-bottom-right' : 'origin-bottom-left',
    variant === 'danger' ? 'bg-red/10' : 'bg-hover',
  )
}

export function MessageBubbleContent({
  className,
  children,
  ref,
  ...props
}: MessageBubbleContentProps) {
  const reduce = useReducedMotion() ?? false
  const {
    align = 'start',
    animateIn,
    variant,
  } = useContext(MessageBubbleContext)

  return (
    <div
      ref={ref}
      data-slot="message-bubble-content"
      className={cn(bubbleContentClass(variant), className)}
      {...props}
    >
      <motion.span
        aria-hidden="true"
        layout={reduce ? false : 'size'}
        initial={animateIn && !reduce ? { opacity: 0, scale: 0.92 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduce
            ? { duration: 0 }
            : {
                opacity: { duration: 0.12, ease: EASE_OUT },
                scale: BUBBLE_POP,
                layout: SPRING_LAYOUT,
              }
        }
        className={bubbleSurfaceClass(variant, align)}
      />
      <motion.div
        initial={animateIn ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={
          reduce ? { duration: 0.12, ease: EASE_OUT } : BUBBLE_CONTENT_REVEAL
        }
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  )
}
