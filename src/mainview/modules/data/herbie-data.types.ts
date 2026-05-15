// Free-form string — built-in ids (`claude`/`codex`/`gemini`/`hermes`)
// plus any user-registered custom agent. Validated server-side against
// the live agent registry on each send.
export type AgentId = string

export type ScheduleConfig =
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'interval'; hours: number }
  | { kind: 'weekly'; weekday: number; hour: number; minute: number }
  | { kind: 'cron'; cron: string }
