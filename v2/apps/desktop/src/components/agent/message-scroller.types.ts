import type { ComponentPropsWithRef, Ref } from 'react'

export interface MessageScrollerProps extends ComponentPropsWithRef<'div'> {
  /** Keep streamed output pinned while the reader remains near the end. */
  followOutput?: boolean
  /** Distance from the end that still counts as following the output. */
  followThreshold?: number
  /** Smoothly follow growing content. */
  smooth?: boolean
  /** Reports when the reader leaves or returns to the live edge. */
  onFollowChange?: (following: boolean) => void
  /** Accessible label for the scrollable transcript. */
  label?: string
  /** Marks the transcript as waiting for more streamed content. */
  busy?: boolean
  /** Adds a compact rail for navigating between rendered message rows. */
  navigation?: 'rail'
  /** Accessible label for the optional message navigation rail. */
  navigationLabel?: string
  viewportClassName?: string
  contentClassName?: string
  railClassName?: string
  viewportRef?: Ref<HTMLElement>
  viewportProps?: Omit<
    ComponentPropsWithRef<'section'>,
    'children' | 'className' | 'ref'
  >
  contentProps?: Omit<
    ComponentPropsWithRef<'div'>,
    'children' | 'className' | 'ref'
  >
}
