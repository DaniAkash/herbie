import { Cron } from 'croner'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { DB } from '../../db'
import { inboxItems } from '../../db/schema/inbox-items.sql'
import { taskRuns } from '../../db/schema/task-runs.sql'
import { tasks } from '../../db/schema/tasks.sql'
import { getRunEventBus } from './run-event-bus'
import { getRunManager } from './runManager'
import { cronExpressionFor, parseSchedule } from './schedule'

// Singleton task scheduler. Backed by croner — one Cron job per
// active task. Re-init on task add/update/delete. On fire: spawns a
// TaskRunSession with trigger='scheduled', waits for a terminal
// event, then writes the inbox card and bumps last/nextRunAt on the
// task row.
//
// Single-process: two Herbie instances on the same machine would
// double-fire. Documented as a known limitation; a launch-time lock
// file lands later if needed.

const TERMINAL_TURN_TYPES = new Set([
  'turn.finish',
  'turn.cancel',
  'turn.error',
])

export interface TaskScheduler {
  start(): Promise<void>
  stop(): void
  rescheduleTask(taskId: string): Promise<void>
  cancelTask(taskId: string): void
}

class TaskSchedulerImpl implements TaskScheduler {
  private readonly jobs = new Map<string, Cron>()

  constructor(private readonly db: DB) {}

  async start(): Promise<void> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.status, 'active'))
      .all()
    for (const row of rows) {
      await this.scheduleRow(row)
      await this.catchUpIfOverdue(row)
    }
  }

  stop(): void {
    for (const job of this.jobs.values()) job.stop()
    this.jobs.clear()
  }

  async rescheduleTask(taskId: string): Promise<void> {
    this.cancelTask(taskId)
    const row = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .get()
    if (!row || row.status !== 'active') return
    await this.scheduleRow(row)
  }

  cancelTask(taskId: string): void {
    const existing = this.jobs.get(taskId)
    if (!existing) return
    existing.stop()
    this.jobs.delete(taskId)
  }

  private async scheduleRow(row: typeof tasks.$inferSelect): Promise<void> {
    const schedule = parseSchedule(row.scheduleJson)
    if (!schedule) return
    const expr = cronExpressionFor(schedule)
    if (!expr) return
    const job = new Cron(expr, { paused: false }, () => {
      void this.fireNow(row.id)
    })
    // Persist the next-fire time so the boot catch-up can decide
    // whether a missed run should fire-once or be skipped.
    const next = job.nextRun()
    if (next) {
      await this.db
        .update(tasks)
        .set({ nextRunAt: next })
        .where(eq(tasks.id, row.id))
        .run()
    }
    this.jobs.set(row.id, job)
  }

  // Per-kind missed-run policy: `interval` tasks fire once on boot
  // if the last run is older than the interval (the user expects
  // periodic activity, not strict wall-clock cadence). Daily / weekly
  // / cron tasks skip the missed slot — re-running yesterday's 9am
  // job at 2pm today is rarely what the user wants.
  private async catchUpIfOverdue(
    row: typeof tasks.$inferSelect,
  ): Promise<void> {
    const schedule = parseSchedule(row.scheduleJson)
    if (!schedule || schedule.kind !== 'interval') return
    const intervalMs = schedule.hours * 60 * 60 * 1000
    const lastRunMs = row.lastRunAt?.getTime() ?? 0
    if (Date.now() - lastRunMs < intervalMs) return
    void this.fireNow(row.id)
  }

  private async fireNow(taskId: string): Promise<void> {
    const row = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .get()
    if (!row || row.status !== 'active') return

    const session = await getRunManager().start({
      taskId,
      promptSnapshot: row.prompt,
      tuple: {
        agentId: row.agentId,
        modelId: row.modelId,
        workspacePath: row.workspacePath,
        reasoningEffort: row.reasoningEffort,
      },
      trigger: 'scheduled',
    })

    // Wait for the run to terminate (success, cancel, or error), then
    // land an inbox card + bump lastRunAt/nextRunAt.
    await this.waitForTerminal(session.id)
    await this.deliverInbox(session.id, row)
    await this.bumpRunTimes(row.id)
  }

  private waitForTerminal(runId: string): Promise<void> {
    return new Promise((resolve) => {
      const unsub = getRunEventBus().subscribe(runId, (ev) => {
        if (!TERMINAL_TURN_TYPES.has(ev.type)) return
        unsub()
        resolve()
      })
    })
  }

  private async deliverInbox(
    runId: string,
    task: typeof tasks.$inferSelect,
  ): Promise<void> {
    const run = await this.db
      .select()
      .from(taskRuns)
      .where(eq(taskRuns.id, runId))
      .get()
    if (!run) return
    await this.db
      .insert(inboxItems)
      .values({
        id: nanoid(),
        taskId: task.id,
        taskName: task.name,
        taskRunId: run.id,
        body: run.resultText ?? '',
        agentId: run.agentId,
        modelId: run.modelId,
        workspacePath: run.workspacePath,
        reasoningEffort: run.reasoningEffort,
        promptSnapshot: run.promptSnapshot,
        status: 'unread',
        starred: false,
        errorMessage: run.errorMessage,
        errorCode: run.errorCode,
        errorDetails: run.errorDetails,
        createdAt: new Date(),
      })
      .run()
  }

  private async bumpRunTimes(taskId: string): Promise<void> {
    const job = this.jobs.get(taskId)
    const next = job?.nextRun() ?? null
    await this.db
      .update(tasks)
      .set({ lastRunAt: new Date(), nextRunAt: next, updatedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .run()
  }
}

let instance: TaskScheduler | null = null

export function getTaskScheduler(db: DB): TaskScheduler {
  if (!instance) instance = new TaskSchedulerImpl(db)
  return instance
}
