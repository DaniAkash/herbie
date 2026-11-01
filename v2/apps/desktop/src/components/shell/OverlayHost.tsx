import { HerbieOverlay } from '@/components/overlays/HerbieOverlay'
import { McpServerOverlay } from '@/components/overlays/McpServerOverlay'
import { NewAgentOverlay } from '@/components/overlays/NewAgentOverlay'
import { SearchOverlay } from '@/components/overlays/SearchOverlay'
import { ToolsOverlay } from '@/components/overlays/ToolsOverlay'
import type { OverlaySearch } from '@/modules/navigation/overlay'

/**
 * Whatever is on top, read from the search param.
 *
 * Absolutely positioned over the whole window, so nothing beneath it
 * unmounts and dismissing is a history step rather than state of our own.
 */
export function OverlayHost({ search }: { search: OverlaySearch }) {
  if (!search.overlay) return null

  // The palette brings its own fixed backdrop, so wrapping it in ours would
  // dim the screen twice and fight its own positioning.
  if (search.overlay === 'search') return <SearchOverlay />

  return (
    <>
      {search.overlay === 'tools' && <ToolsOverlay />}
      {search.overlay === 'server' && <McpServerOverlay id={search.server} />}
      {search.overlay === 'new' && <NewAgentOverlay />}
      {search.overlay === 'herbie' && <HerbieOverlay />}
    </>
  )
}
