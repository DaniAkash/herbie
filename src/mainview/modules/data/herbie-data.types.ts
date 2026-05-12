export type AgentId = 'claude' | 'codex' | 'gemini' | 'hermes'

export type ScheduleConfig =
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'interval'; hours: number }
  | { kind: 'weekly'; weekday: number; hour: number; minute: number }
  | { kind: 'cron'; cron: string }
