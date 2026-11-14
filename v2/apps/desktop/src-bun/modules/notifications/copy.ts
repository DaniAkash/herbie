import { basename } from 'node:path'
import type { NotifyEvent } from '@bun/modules/notifications/events'

/**
 * Every string a person reads, in one place.
 *
 * A new kind is a row here and a variant in the union, which is the whole of
 * what adding one costs.
 */

/**
 * The agent, then where it works.
 *
 * Deduplicated when the two are the same string, which otherwise renders as
 * a name repeated twice and reads like a bug. agent-terminal hit exactly
 * this in production. The comparison folds case and separators because an
 * agent called Ops working in `ops` is the case that actually occurs, and
 * `Ops · ops` is the bug this exists to prevent.
 */
export function titleFor(name: string, workspaceDir: string): string {
  const where = basename(workspaceDir)
  if (!where || sameLabel(where, name)) return name
  return `${name} · ${where}`
}

function sameLabel(a: string, b: string): boolean {
  return fold(a) === fold(b)
}

function fold(value: string): string {
  return value.toLowerCase().replace(/[\s._-]+/g, '')
}

function fallbackFor(event: NotifyEvent): string {
  switch (event.kind) {
    case 'needs_you':
      return event.reason === 'permission'
        ? 'Wants to run something and needs your go-ahead'
        : 'Asked you a question'
    case 'turn_failed':
      return 'Stopped with an error'
    case 'agent_parked':
      return 'Paused itself after repeated failures'
    case 'turn_done':
      return 'Finished its turn'
    case 'routine_done':
      return 'Finished a routine'
  }
}

/** One line, so a banner is not a wall of the agent's own prose. */
const BODY_LIMIT = 140

/**
 * The agent's own words where the record carried any, otherwise the fallback.
 *
 * Never logged at any level: this is arbitrary content the agent wrote, and
 * filtering it would be unreliable theatre.
 */
export function bodyFor(event: NotifyEvent): string {
  const own = event.text?.trim().replace(/\s+/g, ' ')
  if (!own) return fallbackFor(event)
  if (own.length <= BODY_LIMIT) return own
  return `${own.slice(0, BODY_LIMIT - 1).trimEnd()}…`
}

export function routeFor(event: NotifyEvent): string {
  return `/agents/${event.agentId}`
}
