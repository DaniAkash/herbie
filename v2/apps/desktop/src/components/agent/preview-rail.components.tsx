import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { CSSProperties, MouseEvent, PointerEvent, ReactNode } from 'react'
import { EASE_OUT, SPRING_LAYOUT } from '@/lib/ease'
import { cn } from '@/lib/utils'
import type { RailHighlight } from './preview-rail.hooks'
import type { PreviewRailItem } from './preview-rail.types'

function DefaultPreview({ item }: { item: PreviewRailItem }) {
  return (
    <div
      data-slot="preview-rail-card"
      className="rounded-2xl border border-line bg-surface p-4 shadow-sm"
    >
      <p data-slot="preview-rail-title" className="font-medium text-ink">
        {item.label}
      </p>
      {item.description ? (
        <div
          data-slot="preview-rail-description"
          className="mt-1 text-ink-3 text-sm leading-6"
        >
          {item.description}
        </div>
      ) : null}
    </div>
  )
}

/** How far a tick extends, by how many places it sits from the highlight. */
function tickScale(distance: number) {
  if (distance === 0) return 1
  if (distance === 1) return 0.68
  if (distance === 2) return 0.44
  return 0.25
}

interface RailTickProps {
  item: PreviewRailItem
  distance: number
  highlighted: boolean
  selected: boolean
  isHorizontal: boolean
  itemSize: number
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void
  onPointerDown: (event: PointerEvent<HTMLElement>) => void
  onDropGesture: () => void
  onFocusItem: (currentTarget: HTMLElement) => void
  onSelect: (event: MouseEvent<HTMLElement>) => void
}

function PreviewRailTick({
  item,
  distance,
  highlighted,
  selected,
  isHorizontal,
  itemSize,
  onPointerEnter,
  onPointerDown,
  onDropGesture,
  onFocusItem,
  onSelect,
}: RailTickProps) {
  const reduce = useReducedMotion()

  const tick = (
    <motion.span
      data-slot="preview-rail-tick"
      aria-hidden="true"
      animate={
        isHorizontal
          ? { scaleY: tickScale(distance) }
          : { scaleX: tickScale(distance) }
      }
      transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
      className={cn(
        'block bg-current',
        isHorizontal ? 'h-12 w-0.5 origin-bottom' : 'h-0.5 w-12 origin-left',
        highlighted && 'text-ink',
      )}
    />
  )

  const shared = {
    'data-slot': 'preview-rail-item',
    'aria-label': item.ariaLabel ?? item.label,
    onPointerEnter,
    onPointerDown,
    onPointerCancel: onDropGesture,
    onKeyDown: onDropGesture,
    onFocus: (event: { currentTarget: HTMLElement }) =>
      onFocusItem(event.currentTarget),
    onClick: onSelect,
    style: (isHorizontal
      ? { width: itemSize }
      : { height: itemSize }) as CSSProperties,
    className: cn(
      'relative flex text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-page',
      isHorizontal
        ? 'h-12 w-6 items-end justify-center'
        : 'h-6 w-12 items-center',
    ),
  }

  return item.href ? (
    <a
      {...shared}
      href={item.href}
      target={item.target}
      rel={
        item.rel ??
        (item.target === '_blank' ? 'noreferrer noopener' : undefined)
      }
      aria-current={selected ? 'page' : undefined}
    >
      {tick}
    </a>
  ) : (
    <button
      {...shared}
      type="button"
      aria-current={selected ? 'location' : undefined}
    >
      {tick}
    </button>
  )
}

interface PreviewCardProps {
  item: PreviewRailItem
  layoutId: string
  children: ReactNode
}

/**
 * One card, floating beside its tick. The outer layer owns the layoutId so the
 * card glides between ticks, while the inner one crossfades its contents; a
 * single element cannot do both without the glide restarting on every swap.
 */
function PreviewRailCard({ item, layoutId, children }: PreviewCardProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      layoutId={layoutId}
      transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={item.id}
          initial={
            reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: 'blur(6px)' }
          }
          animate={
            reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }
          }
          exit={
            reduce
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  y: -2,
                  filter: 'blur(4px)',
                  transition: { duration: 0.12, ease: EASE_OUT },
                }
          }
          transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

export interface PreviewRailPreviewsProps {
  items: PreviewRailItem[]
  displayedId: string
  isHorizontal: boolean
  previewSide: 'before' | 'after'
  itemSize: number
  rowTemplate: string | undefined
  layoutId: string
  renderPreview?: (item: PreviewRailItem) => ReactNode
  containerClassName?: string
  cardClassName?: string
}

/**
 * The cards, on a grid that mirrors the rail so each one sits level with its
 * own tick. Every slot is laid out and only the displayed one is filled.
 */
export function PreviewRailPreviews({
  items,
  displayedId,
  isHorizontal,
  previewSide,
  itemSize,
  rowTemplate,
  layoutId,
  renderPreview,
  containerClassName,
  cardClassName,
}: PreviewRailPreviewsProps) {
  return (
    <div
      aria-hidden="true"
      style={
        isHorizontal
          ? { gridTemplateColumns: rowTemplate }
          : { gridTemplateRows: rowTemplate }
      }
      className={cn(
        'pointer-events-none absolute z-50 grid',
        isHorizontal
          ? 'top-1/2 left-1/2 h-5 w-fit max-w-full -translate-x-1/2 -translate-y-1/2 justify-center'
          : previewSide === 'before'
            ? 'inset-y-0 right-16 left-4 content-center'
            : 'inset-y-0 right-4 left-16 content-center',
        containerClassName,
      )}
    >
      {items.map((item) => (
        <div
          key={item.id}
          style={isHorizontal ? { width: itemSize } : { height: itemSize }}
          className={cn(
            'relative flex items-center',
            isHorizontal && 'justify-center',
          )}
        >
          {item.id === displayedId ? (
            <div
              className={cn(
                isHorizontal
                  ? 'absolute bottom-12 left-1/2 w-72 -translate-x-1/2'
                  : cn(
                      'w-full max-w-sm',
                      previewSide === 'before' && 'ml-auto',
                    ),
                cardClassName,
              )}
            >
              <PreviewRailCard item={item} layoutId={layoutId}>
                {renderPreview ? (
                  renderPreview(item)
                ) : (
                  <DefaultPreview item={item} />
                )}
              </PreviewRailCard>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export interface PreviewRailTicksProps {
  items: PreviewRailItem[]
  highlight: RailHighlight
  isHorizontal: boolean
  itemSize: number
  rowTemplate: string | undefined
  label: string
  className?: string
}

export function PreviewRailTicks({
  items,
  highlight,
  isHorizontal,
  itemSize,
  rowTemplate,
  label,
  className,
}: PreviewRailTicksProps) {
  return (
    <nav
      aria-label={label}
      onPointerLeave={highlight.leave}
      style={
        isHorizontal
          ? { gridTemplateColumns: rowTemplate }
          : { gridTemplateRows: rowTemplate }
      }
      className={cn(
        'relative z-10 grid shrink-0',
        isHorizontal
          ? 'h-12 w-fit max-w-full justify-center self-center'
          : 'w-12 content-center',
        className,
      )}
    >
      {items.map((item, index) => (
        <PreviewRailTick
          key={item.id}
          item={item}
          distance={
            highlight.displayedIndex < 0
              ? Number.POSITIVE_INFINITY
              : Math.abs(index - highlight.displayedIndex)
          }
          highlighted={item.id === highlight.highlightedId}
          selected={item.id === highlight.selectedId}
          isHorizontal={isHorizontal}
          itemSize={itemSize}
          onPointerEnter={(event) => highlight.enter(item, event)}
          onPointerDown={(event) => highlight.press(item, event)}
          onDropGesture={highlight.dropGesture}
          onFocusItem={(element) => highlight.focusItem(item, element)}
          onSelect={highlight.select(item)}
        />
      ))}
    </nav>
  )
}
