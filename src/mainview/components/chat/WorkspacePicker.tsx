import { CheckIcon, ChevronDownIcon, FolderIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWorkspaces } from '@/modules/api/settings.hooks'
import { pickDirectory } from '@/modules/system/pickDirectory'

export interface WorkspacePickerProps {
  // null means "use the user's default workspace"; the resolved cwd lives
  // server-side, so the renderer doesn't need to substitute it here.
  value: string | null
  onChange: (path: string | null) => void
}

function basename(p: string): string {
  const segs = p.split('/').filter(Boolean)
  return segs[segs.length - 1] ?? p
}

export function WorkspacePicker({ value, onChange }: WorkspacePickerProps) {
  const { defaultPath, recent, addRecent } = useWorkspaces()
  const effectivePath = value ?? defaultPath
  const label = effectivePath ? basename(effectivePath) : 'workspace'

  async function handlePick() {
    const picked = await pickDirectory()
    if (!picked) return
    addRecent(picked)
    onChange(picked)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <FolderIcon data-icon="inline-start" />
        <span className="font-mono text-xs">{label}</span>
        <ChevronDownIcon data-icon="inline-end" className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Workspace
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {defaultPath && (
            <DropdownMenuItem
              onSelect={() => onChange(null)}
              className="flex items-start gap-2"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {basename(defaultPath)}{' '}
                  <span className="font-normal text-muted-foreground text-xs">
                    (default)
                  </span>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {defaultPath}
                </div>
              </div>
              {value === null && (
                <CheckIcon className="mt-0.5 size-4 text-primary" />
              )}
            </DropdownMenuItem>
          )}
          {recent.length > 0 && <DropdownMenuSeparator />}
          {recent.map((path) => (
            <DropdownMenuItem
              key={path}
              onSelect={() => onChange(path)}
              className="flex items-start gap-2"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{basename(path)}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {path}
                </div>
              </div>
              {value === path && (
                <CheckIcon className="mt-0.5 size-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            // The native file dialog opens after the menu closes — kicking
            // the actual call to a microtask via the void/async boundary
            // is enough to let the menu animation finish.
            onSelect={() => {
              void handlePick()
            }}
            className="flex items-center gap-2"
          >
            <PlusIcon className="size-4" />
            <span className="text-sm">Pick directory…</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
