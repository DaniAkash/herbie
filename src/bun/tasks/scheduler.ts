import { Cron } from 'croner'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { DB } from '../../db'
import { inboxItems } from '../../db/schema/inbox-items.sql'
import { taskRuns } from '../../db/schema/task-runs.sql'
import { tasks } from '../../db/schema/tasks.sql'
import { getRunManager } from './runManager'
import { cronExpressionFor, parseSchedule } from './schedule'

// Singleton task scheduler. Backed by croner — one Cron job per
// active task. Re-init on task add/update/delete. On fire: spawns a
// TaskRunSession with trigger='scheduled', awaits the run's done
// promise (resolves after the row's resultText is persisted), then
// writes the inbox card and bumps last/nextRunAt on the task row.
//
// Single-process: two Herbie instances on the same machine would
// double-fire. Documented as a known limitation; a launch-time lock
// file lands later if needed.

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
    // `new Cron(expr, …)` throws synchronously on a malformed pattern.
    // We can't let that kill the bun process — one bad row would take
    // every other scheduled task down with it. Validation lives in the
    // API + form schemas, but pre-validation data and future schema
    // drift still land here. Skip + log; the row stays untouched on
    // disk and the user can fix it from the editor.
    let job: Cron
    try {
      job = new Cron(expr, { paused: false }, () => {
        // fireNow's rejection is unowned in this callback; without
        // `.catch` a DB hiccup or agent-spawn failure becomes an
        // unhandled rejection that destabilises the bun process.
        // Log + swallow keeps the scheduler loop healthy.
        this.fireNow(row.id).catch(logFireFailure(row))
      })
    } catch (err) {
      // biome-ignore lint/suspicious/noConsole: surface bad cron rows at boot — no logger wired in bun yet
      console.warn(
        `[tasks] skipping task ${row.id} (${row.name}) — invalid cron expression ${JSON.stringify(expr)}:`,
        err instanceof Error ? err.message : err,
      )
      return
    }
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
    // Same unhandled-rejection guard as the cron callback path.
    this.fireNow(row.id).catch(logFireFailure(row))
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

    // Wait for the run's finalize() to write the row, then deliver the
    // inbox card and bump lastRunAt/nextRunAt. A bus subscription on
    // turn.finish races: the bus emit happens BEFORE finalize writes
    // resultText, so we'd read an empty body. The session-owned `done`
    // promise resolves only after the row update lands.
    await session.done
    await this.deliverInbox(session.id, row)
    await this.bumpRunTimes(row.id)
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
    // Prefer the structured markdown from herbie__task_result. Fall
    // back to aggregated assistant text only when the tool wasn't
    // called. bodySource mirrors run.outputSource so the inbox
    // renderer can pick the markdown vs text path without joining
    // back to task_runs.
    const body = run.resultMarkdown ?? run.resultText ?? ''
    await this.db
      .insert(inboxItems)
      .values({
        id: nanoid(),
        taskId: task.id,
        taskName: task.name,
        taskRunId: run.id,
        body,
        bodySource: run.outputSource,
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

function logFireFailure(row: typeof tasks.$inferSelect) {
  return (err: unknown) => {
    // biome-ignore lint/suspicious/noConsole: surface fire-time failures — no logger wired in bun yet
    console.warn(
      `[tasks] fire failed for task ${row.id} (${row.name}):`,
      err instanceof Error ? err.message : err,
    )
  }
}
