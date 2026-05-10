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
import { useHerbieData } from '@/modules/data/HerbieDataProvider'

export type WorkspacePickerProps = {
  value: string | undefined
  onChange: (id: string | undefined) => void
  variant?: 'pill' | 'header'
  readOnly?: boolean
}

export function WorkspacePicker({
  value,
  onChange,
  variant = 'pill',
  readOnly,
}: WorkspacePickerProps) {
  const { workspaces } = useHerbieData()
  const current = workspaces.find((w) => w.id === value)
  const pinned = workspaces.filter((w) => w.pinned)
  const recent = workspaces.filter((w) => !w.pinned)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={readOnly}
        render={
          <Button
            variant={variant === 'pill' ? 'ghost' : 'outline'}
            size="sm"
          />
        }
      >
        <FolderIcon data-icon="inline-start" />
        <span className="font-mono text-xs">
          {current ? current.name : '—'}
        </span>
        <ChevronDownIcon data-icon="inline-end" className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Workspace
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onChange(undefined)}>
          <span className="flex-1 text-muted-foreground italic">
            no workspace
          </span>
          {value === undefined && <CheckIcon className="size-4 text-primary" />}
        </DropdownMenuItem>
        {pinned.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
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
            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
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
        <div className="font-mono text-[11px] text-muted-foreground">
          {ws.path}
        </div>
      </div>
      {checked && <CheckIcon className="mt-0.5 size-4 text-primary" />}
    </DropdownMenuItem>
  )
}
