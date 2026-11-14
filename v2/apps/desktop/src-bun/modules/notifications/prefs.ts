import type { Db } from '@bun/modules/db/db'
import { settings } from '@bun/modules/db/schema/schema'
import type { NotifyPrefs } from '@bun/modules/notifications/events'

/**
 * Which kinds are worth an interruption, as rows rather than as branches.
 *
 * Routing is data so a new rule is a setting, which is the third of the three
 * seams this module is built around.
 */

const PREF_KEYS = {
  enabled: 'notify.enabled',
  needsYou: 'notify.needsYou',
  turnFailed: 'notify.turnFailed',
  agentParked: 'notify.agentParked',
  turnDone: 'notify.turnDone',
  routineDone: 'notify.routineDone',
  doneAfterSeconds: 'notify.doneAfterSeconds',
} as const

/**
 * Applied at read time rather than written on install.
 *
 * That way they hold for databases that already exist as well as new ones,
 * which is the same choice quiet hours made for the same reason.
 */
const DEFAULT_PREFS: NotifyPrefs = {
  enabled: true,
  needsYou: true,
  turnFailed: true,
  agentParked: true,
  turnDone: true,
  routineDone: false,
  doneAfterSeconds: 45,
}

export function readPrefs(db: Db): NotifyPrefs {
  const rows = db.select().from(settings).all()
  const raw = (key: string): string | undefined =>
    rows.find((row) => row.key === key)?.value

  const flag = (key: string, fallback: boolean): boolean => {
    const value = raw(key)
    return value === undefined ? fallback : value === '1'
  }

  const seconds = Number(raw(PREF_KEYS.doneAfterSeconds))

  return {
    enabled: flag(PREF_KEYS.enabled, DEFAULT_PREFS.enabled),
    needsYou: flag(PREF_KEYS.needsYou, DEFAULT_PREFS.needsYou),
    turnFailed: flag(PREF_KEYS.turnFailed, DEFAULT_PREFS.turnFailed),
    agentParked: flag(PREF_KEYS.agentParked, DEFAULT_PREFS.agentParked),
    turnDone: flag(PREF_KEYS.turnDone, DEFAULT_PREFS.turnDone),
    routineDone: flag(PREF_KEYS.routineDone, DEFAULT_PREFS.routineDone),
    doneAfterSeconds: Number.isFinite(seconds)
      ? seconds
      : DEFAULT_PREFS.doneAfterSeconds,
  }
}
