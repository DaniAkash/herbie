import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/motion/input'
import { Overlay } from '@/components/shell/Overlay'
import { cn } from '@/lib/utils'
import { useTools } from '@/modules/api/tools.hooks'
import { closeOverlay, openOverlay } from '@/modules/navigation/overlay'

/**
 * One MCP server, in the shape the sidecar actually stores.
 *
 * stdio carries a command and arguments, http carries a url. Both live in one
 * form because they are one row in one table, per settings.mcp.schema.
 */
export function McpServerOverlay({ id }: { id?: string }) {
  const { data } = useTools()
  const existing = data?.servers.find((s) => s.id === id)
  const [kind, setKind] = useState(existing?.kind ?? 'stdio')

  return (
    <Overlay
      narrow
      title={existing ? existing.name : 'New server'}
      lead={
        <Link
          to="."
          search={openOverlay('tools')}
          aria-label="Back"
          className="inline-flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-ink"
        >
          <ChevronLeft size={16} />
        </Link>
      }
      footer={
        <>
          {existing ? (
            <Button size="sm" variant="quiet" className="mr-auto text-red">
              Remove
            </Button>
          ) : null}
          <Link to="." search={openOverlay('tools')}>
            <Button size="sm" variant="quiet">
              Cancel
            </Button>
          </Link>
          <Link to="." search={closeOverlay}>
            <Button size="sm" variant="primary">
              Save
            </Button>
          </Link>
        </>
      }
    >
      <div className="grid gap-3.5">
        <Input label="Name" defaultValue={existing?.name ?? ''} />

        <div>
          <span className="mb-1.5 block font-medium text-[12.5px] text-ink-2">
            Kind
          </span>
          <div className="inline-flex w-full gap-0.5 rounded-full bg-field p-0.5 shadow-hairline">
            {(['stdio', 'http'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={cn(
                  'flex-1 rounded-full px-3 py-1 font-medium text-[12.5px] transition-colors duration-150 ease-out',
                  kind === k
                    ? 'bg-surface text-ink shadow-xs'
                    : 'text-ink-3 hover:text-ink',
                )}
              >
                {k === 'stdio' ? 'Command' : 'URL'}
              </button>
            ))}
          </div>
        </div>

        {kind === 'stdio' ? (
          <>
            <Input label="Command" defaultValue={existing?.target ?? ''} />
            <Input label="Arguments" defaultValue={existing?.args ?? ''} />
          </>
        ) : (
          <Input label="URL" defaultValue={existing?.target ?? ''} />
        )}
      </div>
    </Overlay>
  )
}
