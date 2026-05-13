import {
  MoreHorizontalIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  type TelegramConnection,
  useDeleteTelegramConnection,
  usePauseTelegramConnection,
  useResumeTelegramConnection,
  useTelegramConnections,
} from '@/modules/api/telegram.hooks'
import type { AgentId } from '@/modules/data/herbie-data.types'
import { EditConnectionForm } from './MobileTab.edit-form'
import { AddConnectionForm } from './MobileTab.forms'
import { AGENT_LABELS, DetailRow } from './mobile-tab.constants'

export function MobileTab() {
  const { data, isLoading } = useTelegramConnections()
  const [addOpen, setAddOpen] = useState(false)
  const connections = data ?? []

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium text-sm">Telegram</h2>
          <p className="text-muted-foreground text-xs">
            Connect a Telegram bot to chat with one of your agents from
            anywhere. Each connection pins its own agent, workspace, and model.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <PlusIcon data-icon="inline-start" />
            Add connection
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <AddConnectionForm onDone={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      ) : connections.length === 0 ? (
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <div className="flex flex-col gap-3">
          {connections.map((conn) => (
            <ConnectionCard key={conn.id} connection={conn} />
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
        <EmptyTitle>No Telegram bots yet</EmptyTitle>
        <EmptyDescription>
          Add a bot token from <span className="font-mono">@BotFather</span> on
          Telegram. Herbie reaches Telegram via polling — no public URL needed.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onAdd}>
          <PlusIcon data-icon="inline-start" />
          Add your first connection
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function ConnectionCard({ connection }: { connection: TelegramConnection }) {
  const [editOpen, setEditOpen] = useState(false)
  const pause = usePauseTelegramConnection()
  const resume = useResumeTelegramConnection()
  const remove = useDeleteTelegramConnection()

  const statusColor =
    connection.status === 'active'
      ? 'bg-emerald-500'
      : connection.status === 'paused'
        ? 'bg-muted-foreground/40'
        : 'bg-destructive'

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span
              className={cn('size-2 rounded-full', statusColor)}
              aria-hidden
            />
            <span className="truncate font-medium text-sm">
              {connection.name}
            </span>
            <Badge variant="outline" className="text-[10px] capitalize">
              {connection.status}
            </Badge>
          </div>
          {connection.botUsername && (
            <span className="font-mono text-[11px] text-muted-foreground">
              @{connection.botUsername}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Connection actions"
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <PencilIcon data-icon="inline-start" />
                Rename / update token
              </DropdownMenuItem>
              {connection.status === 'active' ? (
                <DropdownMenuItem
                  onClick={() => {
                    void pause.mutateAsync({ id: connection.id })
                  }}
                >
                  <PauseIcon data-icon="inline-start" />
                  Pause
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => {
                    void resume.mutateAsync({ id: connection.id })
                  }}
                >
                  <PlayIcon data-icon="inline-start" />
                  {connection.status === 'error' ? 'Retry' : 'Resume'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  void remove.mutateAsync({ id: connection.id }).then(() => {
                    toast.success('Connection deleted')
                  })
                }}
                variant="destructive"
              >
                <Trash2Icon data-icon="inline-start" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <DetailRow
          label="Agent"
          value={
            AGENT_LABELS[connection.agentId as AgentId] ?? connection.agentId
          }
        />
        <DetailRow
          label="Model"
          value={connection.modelId ?? 'agent default'}
          mono
        />
        <DetailRow
          label="Workspace"
          value={connection.workspacePath}
          mono
          className="col-span-2"
        />
        {connection.reasoningEffort && (
          <DetailRow label="Reasoning" value={connection.reasoningEffort} />
        )}
      </div>

      {connection.lastError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <TriangleAlertIcon className="size-3.5" />
            Last error
          </div>
          <div className="mt-0.5 font-mono text-[11px] leading-snug">
            {connection.lastError}
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <EditConnectionForm
            connection={connection}
            onDone={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
