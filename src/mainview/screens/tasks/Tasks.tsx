import { useNavigate } from '@tanstack/react-router'
import { ClockIcon, PlusIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import type { ScheduleConfig } from '@/modules/data/herbie-data.types'
import { relativeTime } from '@/modules/utils/relativeTime'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function describeSchedule(s: ScheduleConfig): string {
  if (s.kind === 'daily') return `every day at ${pad(s.hour)}:${pad(s.minute)}`
  if (s.kind === 'interval') return `every ${s.hours} hours`
  if (s.kind === 'weekly')
    return `${WEEKDAYS[s.weekday]} at ${pad(s.hour)}:${pad(s.minute)}`
  return `cron "${s.cron}"`
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function Tasks() {
  const { tasks } = useHerbieData()
  const navigate = useNavigate()
  const sorted = [...tasks].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-border border-b bg-background/95 px-6 py-3 backdrop-blur">
        <h1 className="font-semibold text-base">Scheduled tasks</h1>
        <LinkButton to="/tasks/new" size="sm" className="gap-1.5">
          <PlusIcon className="h-3.5 w-3.5" />
          New task
        </LinkButton>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {sorted.length === 0 ? (
            <EmptyTasks />
          ) : (
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Last run</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((task) => (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate({
                          to: '/tasks/$id',
                          params: { id: task.id },
                        })
                      }
                    >
                      <TableCell className="font-medium">{task.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {describeSchedule(task.schedule)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {task.agent}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {task.lastRunAt
                          ? relativeTime(task.lastRunAt)
                          : 'never'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            task.status === 'active' ? 'default' : 'secondary'
                          }
                        >
                          {task.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyTasks() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <ClockIcon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium text-sm">No scheduled tasks yet</p>
      <p className="max-w-md text-muted-foreground text-xs">
        Tasks let you run a prompt on a schedule. Results land in your inbox for
        review.
      </p>
      <LinkButton to="/tasks/new" size="sm" className="mt-2 gap-1.5">
        <PlusIcon className="h-3.5 w-3.5" />
        Create a task
      </LinkButton>
    </div>
  )
}
