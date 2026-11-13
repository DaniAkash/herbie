import { motion } from 'motion/react'
import { useId } from 'react'
import { cn } from '@/lib/utils'
import {
  PreviewRailPreviews,
  PreviewRailTicks,
} from './preview-rail.components'
import { useRailHighlight } from './preview-rail.hooks'
import type { PreviewRailProps } from './preview-rail.types'

/**
 * A column of tick marks that scale by distance from the highlighted one, with
 * a preview card floating beside the active tick.
 */
export function PreviewRail({
  items,
  label = 'Section navigation',
  orientation = 'vertical',
  activeId,
  defaultActiveId,
  onActiveChange,
  onItemSelect,
  renderPreview,
  showPreview = true,
  previewSide = 'after',
  highlightActive = false,
  itemSize = 24,
  children,
  className,
  railClassName,
  previewContainerClassName,
  previewClassName,
}: PreviewRailProps) {
  const uid = useId()
  const highlight = useRailHighlight({
    items,
    activeId,
    defaultActiveId,
    highlightActive,
    onActiveChange,
    onItemSelect,
  })

  const isHorizontal = orientation === 'horizontal'
  const rowTemplate = items.length
    ? `repeat(${items.length}, ${itemSize}px)`
    : undefined

  return (
    <motion.div
      layoutRoot
      ref={highlight.rootRef}
      onBlur={(event: React.FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          highlight.blurAway()
        }
      }}
      className={cn(
        'relative isolate flex w-full overflow-visible',
        isHorizontal
          ? 'min-h-64 flex-col items-center justify-center'
          : 'min-h-80',
        className,
      )}
    >
      <PreviewRailTicks
        items={items}
        highlight={highlight}
        isHorizontal={isHorizontal}
        itemSize={itemSize}
        rowTemplate={rowTemplate}
        label={label}
        className={railClassName}
      />

      {showPreview ? (
        <PreviewRailPreviews
          items={items}
          displayedId={highlight.displayedId}
          isHorizontal={isHorizontal}
          previewSide={previewSide}
          itemSize={itemSize}
          rowTemplate={rowTemplate}
          layoutId={`preview-rail-card-${uid}`}
          renderPreview={renderPreview}
          containerClassName={previewContainerClassName}
          cardClassName={previewClassName}
        />
      ) : null}

      {children ? (
        <div className="min-h-0 min-w-0 flex-1">{children}</div>
      ) : null}
    </motion.div>
  )
}
