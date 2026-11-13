import { AnimateIcon } from '@animate-ui/react/icons'
import { Link } from '@tanstack/react-router'
import { FolderOpen } from '@/components/animate-ui/icons/folder-open'
import { Pencil } from '@/components/animate-ui/icons/pencil'
import { Plus } from '@/components/animate-ui/icons/plus'
import { Overlay } from '@/components/shell/Overlay'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import { Button } from '@/components/ui/button'
import { useTools } from '@/modules/api/tools.hooks'
import { closeOverlay, openOverlay } from '@/modules/navigation/overlay'

/**
 * The shared library.
 *
 * Reports reach rather than offering a toggle: a global switch here would
 * mean something different from the per agent one on the Permissions tab, and
 * you would never know which had stopped a server from running.
 */
export function ToolsOverlay() {
  const { data, isPending, isError } = useTools()

  return (
    <Overlay
      title="Tools"
      footer={
        <Link to="." search={closeOverlay}>
          <Button size="sm" variant="secondary">
            Done
          </Button>
        </Link>
      }
    >
      <p className="mb-4 text-ink-2">
        Added once here, then switched on per agent under its Permissions.
      </p>

      {isPending ? <p className="text-ink-3">Reading the library...</p> : null}
      {isError ? <p className="text-red">The sidecar did not answer.</p> : null}

      {data ? (
        <>
          <PanelSection label="MCP servers">
            {data.servers.map((server) => (
              <PanelRow
                key={server.id}
                k={<span className="font-mono text-[13px]">{server.name}</span>}
                v={
                  <span className="font-mono">
                    {server.target}
                    {server.args ? ` ${server.args}` : ''}
                  </span>
                }
              >
                <span className="inline-flex items-center rounded-full bg-field px-2 py-0.5 font-medium text-[12px] text-ink-2 shadow-hairline">
                  {server.status === 'failed' ? 'failed' : server.kind}
                </span>
                <AnimateIcon animateOnHover asChild>
                  <Link
                    to="."
                    search={openOverlay('server', server.id)}
                    aria-label={`Edit ${server.name}`}
                    className="inline-flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-ink"
                  >
                    <Pencil size={15} />
                  </Link>
                </AnimateIcon>
              </PanelRow>
            ))}
          </PanelSection>

          <div className="-mt-4 mb-6 flex justify-end">
            <Link to="." search={openOverlay('server', 'new')}>
              <AnimateIcon animateOnHover asChild>
                <Button size="xs" variant="ghost">
                  <Plus size={14} />
                  Add server
                </Button>
              </AnimateIcon>
            </Link>
          </div>

          <PanelSection
            label="Skills"
            note="Markdown files on disk. Ask an agent to write one for you."
          >
            {data.skills.map((skill) => (
              <PanelRow key={skill.id} k={skill.name} v={skill.description} />
            ))}
          </PanelSection>

          <div className="-mt-4 flex justify-end">
            <AnimateIcon animateOnHover asChild>
              <Button size="xs" variant="ghost">
                <FolderOpen size={14} />
                Open folder
              </Button>
            </AnimateIcon>
          </div>
        </>
      ) : null}
    </Overlay>
  )
}
