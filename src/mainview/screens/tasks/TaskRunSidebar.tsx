import {
  ChevronRightIcon,
  CircleDotIcon,
  PlayIcon,
  SquareIcon,
  XCircleIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ComposerTuple } from '@/components/chat/composer.types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  type TaskRunSummary,
  useCancelTaskRun,
  useTaskRuns,
  useTestTaskRun,
} from '@/modules/api/task-runs.hooks'
import type { AgentId } from '@/modules/data/herbie-data.types'
import { clockTime, relativeTime } from '@/modules/utils/relativeTime'
import { ChatMessageRow } from '../chat/Chat.parts'
import { useRunData } from './run.data'

export interface TaskRunSidebarProps {
  // null = create mode (no persisted task yet). When null, the sidebar
  // skips the runs query (nothing to list) and the Test button routes
  // through `onBeforeTest` to persist the draft first.
  taskId: string | null
  draft: {
    prompt: string
    tuple: ComposerTuple
  }
  // Called before Test fires when there's no taskId yet. Must validate
  // + persist the draft and return the new task id (or null when
  // validation fails). The sidebar runs the test against that id. The
  // parent is responsible for any navigation that should follow.
  onBeforeTest?: () => Promise<string | null>
}

const TEXT_ONLY_PART_KINDS = ['text'] as const

// Right-side panel paired with TaskEditor. Top: Test button that
// fires the current draft against the persisted task; flips to Stop
// while a run streams. Below: list of past runs, latest first. The
// expanded run renders through ChatMessageRow with partKinds={['text']}
// so reasoning + tool blocks stay hidden — only the final synthesized
// content shows, matching the plan's "natural for the user" goal.
export function TaskRunSidebar({
  taskId,
  draft,
  onBeforeTest,
}: TaskRunSidebarProps) {
  // `enabled: false` short-circuits the runs fetch in create mode —
  // there's no persisted id yet so the list is necessarily empty.
  const runsQuery = useTaskRuns({
    variables: { id: taskId ?? '' },
    enabled: taskId != null,
  })
  const testMutation = useTestTaskRun()
  const cancelMutation = useCancelTaskRun()
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  // Covers the full Test click — including the `onBeforeTest` create
  // step in create mode — so the button can stay disabled across the
  // whole transition. `testMutation.isPending` alone misses the create
  // window.
  const [isStartingTest, setIsStartingTest] = useState(false)
  const runs = runsQuery.data ?? []
  const inFlight = runs.find((r) => r.status === 'running') ?? null
  const isRunning = inFlight !== null
  // Show the in-flight run by default; otherwise the latest. The user
  // can click any past run to switch.
  useEffect(() => {
    if (selectedRunId) return
    const target = inFlight?.id ?? runs[0]?.id ?? null
    if (target) setSelectedRunId(target)
  }, [selectedRunId, inFlight, runs])

  async function handleTest() {
    if (isRunning || isStartingTest) return
    setIsStartingTest(true)
    try {
      // Create mode: persist the draft first, then fire the test
      // against the new id. The parent's `onBeforeTest` handles the
      // navigation to /tasks/:id so the user lands mid-test.
      let id = taskId
      if (id == null) {
        if (!onBeforeTest) return
        id = await onBeforeTest()
        if (id == null) return
      }
      const res = await testMutation.mutateAsync({
        id,
        prompt: draft.prompt,
        agentId: draft.tuple.agentId,
        modelId: draft.tuple.modelId,
        workspacePath: draft.tuple.workspacePath,
        reasoningEffort: draft.tuple.reasoningEffort,
      })
      setSelectedRunId(res.runId)
    } catch {
      // toast surfaced by useTestTaskRun.onError
    } finally {
      setIsStartingTest(false)
    }
  }

  async function handleStop() {
    if (!inFlight || taskId == null) return
    try {
      await cancelMutation.mutateAsync({ taskId, runId: inFlight.id })
    } catch {
      // toast surfaced by useCancelTaskRun.onError
    }
  }

  // Minimal "is there anything to test" gate. Full validation lives
  // in `onBeforeTest` (create mode) or is implied by the persisted
  // row (edit mode); we only block here so the button isn't enabled
  // when there's literally no prompt at all.
  const canTest = draft.prompt.trim().length > 0

  return (
    <aside className="flex w-[420px] shrink-0 flex-col overflow-hidden border-l bg-card/30">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <div className="font-semibold text-sm">Test runs</div>
          <div className="text-[11px] text-muted-foreground">
            Run the current draft against the agent. Each test gets a fresh
            session — the agent has no memory of prior runs.
          </div>
        </div>
        {isRunning ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleStop}
            disabled={cancelMutation.isPending}
          >
            <SquareIcon data-icon="inline-start" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleTest}
            disabled={!canTest || isStartingTest}
          >
            <PlayIcon data-icon="inline-start" />
            {isStartingTest ? 'Starting…' : 'Test'}
          </Button>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {runsQuery.isLoading ? (
          <RunListSkeleton />
        ) : runs.length === 0 ? (
          <EmptyRuns />
        ) : (
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
            <ul className="flex flex-col gap-1">
              {runs.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  selected={run.id === selectedRunId}
                  onSelect={() => setSelectedRunId(run.id)}
                />
              ))}
            </ul>
            {selectedRunId && taskId != null && (
              <RunDetail taskId={taskId} runId={selectedRunId} />
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

function RunListSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

function EmptyRuns() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10">
      <Empty>
        <EmptyTitle>No runs yet</EmptyTitle>
        <EmptyDescription>
          Click Test to run the current draft and see the agent's response here.
        </EmptyDescription>
      </Empty>
    </div>
  )
}

function RunRow({
  run,
  selected,
  onSelect,
}: {
  run: TaskRunSummary
  selected: boolean
  onSelect: () => void
}) {
  const duration = run.finishedAt
    ? `${((run.finishedAt - run.startedAt) / 1000).toFixed(1)}s`
    : '—'
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-foreground/5 ${
          selected ? 'bg-foreground/10' : ''
        }`}
      >
        <RunStatusIcon status={run.status} />
        <span className="text-muted-foreground tabular-nums">
          {relativeTime(run.startedAt)}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70 uppercase">
          {run.agentId}
        </span>
        {run.trigger === 'test' && (
          <Badge variant="outline" className="text-[9px]">
            test
          </Badge>
        )}
        <span className="ml-auto text-muted-foreground/70 tabular-nums">
          {duration}
        </span>
        <ChevronRightIcon className="size-3 opacity-50" />
      </button>
    </li>
  )
}

function RunStatusIcon({ status }: { status: TaskRunSummary['status'] }) {
  if (status === 'running')
    return <CircleDotIcon className="size-3 animate-pulse text-primary" />
  if (status === 'error')
    return <XCircleIcon className="size-3 text-destructive" />
  if (status === 'cancelled')
    return <CircleDotIcon className="size-3 text-muted-foreground" />
  return <CircleDotIcon className="size-3 text-emerald-500" />
}

function RunDetail({ taskId, runId }: { taskId: string; runId: string }) {
  const { run, messages, isLoading } = useRunData(taskId, runId)
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 border-t pt-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }
  if (!run) return null

  const promptSnapshot = run.run?.promptSnapshot ?? ''

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <details className="rounded-md border bg-card">
        <summary className="cursor-pointer px-3 py-2 text-[11px] text-muted-foreground uppercase tracking-wider">
          Prompt
        </summary>
        <pre className="whitespace-pre-wrap border-t bg-background/60 px-3 py-2 font-mono text-xs leading-relaxed">
          {promptSnapshot}
        </pre>
      </details>
      <div className="flex flex-col gap-3">
        {messages.map((m) => (
          <ChatMessageRow
            key={m.id}
            message={m}
            agent={run.run.agentId as AgentId}
            partKinds={TEXT_ONLY_PART_KINDS}
          />
        ))}
      </div>
      {run.run?.finishedAt && (
        <div className="border-t pt-2 text-[11px] text-muted-foreground tabular-nums">
          Finished {clockTime(run.run.finishedAt)} ·{' '}
          {((run.run.finishedAt - run.run.startedAt) / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  )
}
