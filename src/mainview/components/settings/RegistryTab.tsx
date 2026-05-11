import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { McpServerForm } from '@/components/settings/McpServerForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  type McpServer,
  type McpServerDraft,
  useMcpRegistry,
} from '@/modules/api/settings.hooks'

export function RegistryTab() {
  const { servers, isLoading, add, update, remove } = useMcpRegistry()
  const [editing, setEditing] = useState<McpServer | null>(null)
  const [open, setOpen] = useState(false)

  if (isLoading) return <Skeleton className="h-40 rounded-lg" />

  function openNew() {
    setEditing(null)
    setOpen(true)
  }

  function openEdit(server: McpServer) {
    setEditing(server)
    setOpen(true)
  }

  function handleSubmit(draft: McpServerDraft) {
    if (editing) update(editing.id, draft)
    else add(draft)
    setOpen(false)
    setEditing(null)
  }

  const existingNames = servers
    .filter((s) => s.id !== editing?.id)
    .map((s) => s.name)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-medium text-sm">MCP servers</h2>
          <p className="text-muted-foreground text-xs">
            Add once — every agent picks up the tools on its next conversation.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" onClick={openNew} />}>
            <PlusIcon data-icon="inline-start" />
            Add server
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <McpServerForm
              server={editing}
              existingNames={existingNames}
              onSubmit={handleSubmit}
            />
          </DialogContent>
        </Dialog>
      </div>

      {servers.length === 0 ? (
        <EmptyState onAdd={openNew} />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border bg-card">
          {servers.map((server) => (
            <McpServerRow
              key={server.id}
              server={server}
              onEdit={() => openEdit(server)}
              onRemove={() => remove(server.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Empty className="rounded-lg border border-dashed bg-card/40 py-10">
      <EmptyHeader>
        <EmptyTitle>No servers yet</EmptyTitle>
        <EmptyDescription>
          MCP servers give agents extra tools — file access, search, database
          queries. Add one and every new conversation can use it.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onAdd}>
          <PlusIcon data-icon="inline-start" />
          Add your first server
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function McpServerRow({
  server,
  onEdit,
  onRemove,
}: {
  server: McpServer
  onEdit: () => void
  onRemove: () => void
}) {
  const detail =
    server.type === 'stdio'
      ? `${server.command}${server.args.length > 0 ? ` ${server.args.join(' ')}` : ''}`
      : server.url
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">{server.name}</span>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {server.type}
          </Badge>
        </div>
        <span className="truncate font-mono text-muted-foreground text-xs">
          {detail}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          aria-label="Edit server"
        >
          <PencilIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove server"
        >
          <Trash2Icon />
        </Button>
      </div>
    </div>
  )
}
