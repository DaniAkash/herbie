import { useNavigate } from '@tanstack/react-router'
import { ClockIcon, PlusIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
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

function describeSchedule(s: ScheduleConfig): string {
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
      <header className="electrobun-webkit-app-region-drag flex shrink-0 items-center justify-between gap-4 border-b bg-background/80 px-6 py-3 backdrop-blur">
        <div className="flex items-baseline gap-3">
          <h1 className="font-semibold text-base tracking-tight">
            Scheduled tasks
          </h1>
          <span className="font-mono text-muted-foreground text-xs">
            {sorted.length} task{sorted.length === 1 ? '' : 's'}
          </span>
        </div>
        <LinkButton to="/tasks/new" size="sm">
          <PlusIcon data-icon="inline-start" />
          New task
        </LinkButton>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-6">
          {sorted.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClockIcon />
                </EmptyMedia>
                <EmptyTitle>No scheduled tasks yet</EmptyTitle>
                <EmptyDescription>
                  Tasks let you run a prompt on a schedule. Results land in your
                  inbox for review.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <LinkButton to="/tasks/new">
                  <PlusIcon data-icon="inline-start" />
                  Create a task
                </LinkButton>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Last run</TableHead>
                    <TableHead className="text-right">Status</TableHead>
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
                      <TableCell>
                        <span className="font-mono text-xs">{task.agent}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs tabular-nums">
                        {task.lastRunAt
                          ? relativeTime(task.lastRunAt)
                          : 'never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            task.status === 'active' ? 'default' : 'secondary'
                          }
                          className="font-mono text-[10px] uppercase tracking-wider"
                        >
                          <span
                            className={
                              task.status === 'active'
                                ? 'mr-1 inline-block size-1.5 rounded-full bg-current'
                                : 'mr-1 inline-block size-1.5 rounded-full bg-muted-foreground'
                            }
                            aria-hidden
                          />
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
