import { HerbieOverlay } from '@/components/overlays/HerbieOverlay'
import { McpServerOverlay } from '@/components/overlays/McpServerOverlay'
import { NewAgentOverlay } from '@/components/overlays/NewAgentOverlay'
import { SearchOverlay } from '@/components/overlays/SearchOverlay'
import { ToolsOverlay } from '@/components/overlays/ToolsOverlay'
import { cn } from '@/lib/utils'
import type { OverlaySearch } from '@/modules/navigation/overlay'

/**
 * Whatever is on top, read from the search param.
 *
 * Absolutely positioned over the whole window, so nothing beneath it
 * unmounts and dismissing is a history step rather than state of our own.
 */
export function OverlayHost({ search }: { search: OverlaySearch }) {
  if (!search.overlay) return null
  const top = search.overlay === 'search'

  return (
    <div
      className={cn(
        'absolute inset-0 z-40 grid bg-black/30 p-5 motion-safe:animate-[herbie-fadein_0.18s_ease-out]',
        top ? 'place-items-start justify-center' : 'place-items-center',
      )}
    >
      {search.overlay === 'tools' && <ToolsOverlay />}
      {search.overlay === 'server' && <McpServerOverlay id={search.server} />}
      {search.overlay === 'new' && <NewAgentOverlay />}
      {search.overlay === 'herbie' && <HerbieOverlay />}
      {search.overlay === 'search' && <SearchOverlay />}
    </div>
  )
}
