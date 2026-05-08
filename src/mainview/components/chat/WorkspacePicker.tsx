import { CheckIcon, ChevronDownIcon, FolderIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'

type WorkspacePickerProps = {
  value: string | undefined
  onChange: (id: string | undefined) => void
  variant?: 'pill' | 'header'
}

export function WorkspacePicker({
  value,
  onChange,
  variant = 'pill',
}: WorkspacePickerProps) {
  const { workspaces } = useHerbieData()
  const current = workspaces.find((w) => w.id === value)
  const pinned = workspaces.filter((w) => w.pinned)
  const recent = workspaces.filter((w) => !w.pinned)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={variant === 'pill' ? 'outline' : 'ghost'}
            size="sm"
            className={cn(
              'gap-1.5',
              variant === 'pill' && 'h-7 rounded-full px-2.5 text-xs',
            )}
          />
        }
      >
        <FolderIcon className="h-3.5 w-3.5" />
        <span>{current ? `in ${current.name}` : 'no workspace'}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onChange(undefined)}>
          <span className="flex-1 text-muted-foreground">no workspace</span>
          {value === undefined && <CheckIcon className="h-4 w-4" />}
        </DropdownMenuItem>
        {pinned.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Pinned
            </DropdownMenuLabel>
            {pinned.map((ws) => (
              <WorkspaceRow
                key={ws.id}
                ws={ws}
                checked={value === ws.id}
                onSelect={() => onChange(ws.id)}
              />
            ))}
          </>
        )}
        {recent.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Recent
            </DropdownMenuLabel>
            {recent.map((ws) => (
              <WorkspaceRow
                key={ws.id}
                ws={ws}
                checked={value === ws.id}
                onSelect={() => onChange(ws.id)}
              />
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function WorkspaceRow({
  ws,
  checked,
  onSelect,
}: {
  ws: { id: string; name: string; path: string }
  checked: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="flex items-start gap-2">
      <div className="flex-1">
        <div className="font-medium text-sm">{ws.name}</div>
        <div className="text-muted-foreground text-xs">{ws.path}</div>
      </div>
      {checked && <CheckIcon className="mt-0.5 h-4 w-4" />}
    </DropdownMenuItem>
  )
}
