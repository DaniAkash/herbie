import type { ReactNode } from 'react'

export interface PreviewRailItem {
  id: string
  label: string
  ariaLabel?: string
  description?: ReactNode
  href?: string
  target?: '_blank' | '_self' | '_parent' | '_top'
  rel?: string
}

export interface PreviewRailProps {
  items: PreviewRailItem[]
  label?: string
  orientation?: 'vertical' | 'horizontal'
  activeId?: string
  defaultActiveId?: string
  onActiveChange?: (id: string) => void
  onItemSelect?: (item: PreviewRailItem) => void
  renderPreview?: (item: PreviewRailItem) => ReactNode
  showPreview?: boolean
  previewSide?: 'before' | 'after'
  highlightActive?: boolean
  itemSize?: number
  children?: ReactNode
  className?: string
  railClassName?: string
  previewContainerClassName?: string
  previewClassName?: string
}
