// Maps the user-facing schedule shapes (daily / weekly / interval /
// cron) to croner-compatible cron expressions, plus a safe JSON
// parser. Kept separate from scheduler.ts so the cron-formatting
// logic stays unit-testable and the scheduler file stays focused on
// lifecycle.

export type ScheduleConfig =
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'interval'; hours: number }
  | { kind: 'weekly'; weekday: number; hour: number; minute: number }
  | { kind: 'cron'; cron: string }

export function parseSchedule(raw: string): ScheduleConfig | null {
  try {
    const parsed = JSON.parse(raw) as { kind?: unknown }
    if (typeof parsed.kind !== 'string') return null
    return parsed as ScheduleConfig
  } catch {
    return null
  }
}

export function cronExpressionFor(schedule: ScheduleConfig): string | null {
  switch (schedule.kind) {
    case 'daily':
      return `${schedule.minute} ${schedule.hour} * * *`
    case 'weekly':
      return `${schedule.minute} ${schedule.hour} * * ${schedule.weekday}`
    case 'interval':
      // Croner doesn't have a first-class "every N hours from now"
      // primitive, but `0 */N * * *` fires at minute 0 of every Nth
      // hour aligned to UTC midnight. For hours that don't divide 24
      // evenly the cadence drifts slightly across days; acceptable
      // for v1, revisit if users want strict N-hours-since-last.
      return `0 */${schedule.hours} * * *`
    case 'cron':
      return schedule.cron
  }
}
