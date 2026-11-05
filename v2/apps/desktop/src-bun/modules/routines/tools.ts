import type { Db } from '@bun/modules/db/db'
import { routines } from '@bun/modules/db/schema/schema'
import { toCron } from '@bun/modules/routines/cadence'
import {
  createShape,
  deleteShape,
  enabledShape,
  find,
  lastRunOf,
  listRoutines,
  listShape,
  nextRun,
  type RoutineView,
  schemaOf,
  updateShape,
  view,
} from '@bun/modules/routines/tools.schemas'
import type { AcpxHostTool } from 'acpx-ai-provider'
import { eq } from 'drizzle-orm'
import type { z } from 'zod'

// One import path for everything a caller needs, so the split stays an
// implementation detail of this module rather than something every call
// site has to know about.
export { nextRun, type RoutineView }

/**
 * Routine management, as five tools the agent calls while talking.
 *
 * There is no form behind this. The person says what they want in the
 * thread, the agent writes it here, and the panel keeps only the two
 * controls worth having without a conversation: the switch and the bin.
 *
 * None of these draws anything. They change a row and hand back the facts,
 * and the agent reports the change with a card it already has: `show_work`
 * for a change, `explain` for a list, `recommend` to choose between
 * cadences, `ask` before deleting. That split is deliberate, because a new
 * block kind for this would say what four existing cards already say.
 */

export const ROUTINE_TOOL_NAMES = [
  'list_routines',
  'create_routine',
  'update_routine',
  'set_routine_enabled',
  'delete_routine',
] as const

/** The rule every description repeats, because it is the one that is got wrong. */
const PLAIN_CADENCE =
  'Write the cadence the way a person says it, such as "every weekday at ' +
  '9" or "every day at 2" or "fridays at 5pm". Never write a cron ' +
  'expression: Herbie parses the words itself and hands back how it read ' +
  'them. If the phrase is not understood the call is refused and nothing is ' +
  'saved, so rephrase and try again rather than storing something that ' +
  'will never fire.'

const PROMPT_ADVICE =
  'The prompt is what you will be asked when this runs, with nobody ' +
  'watching and no conversation around it, so it has to stand alone. ' +
  '"Check it" means nothing in an empty thread. Say what to look at, what ' +
  'counts as worth reporting, and what to leave out.'

export interface RoutineToolContext {
  readonly db: Db
  readonly agentId: string
  readonly now?: () => number
  /** Clears a park when a routine is switched back on. */
  readonly revive?: (agentId: string) => void
}

export function routineTools(
  ctx: RoutineToolContext,
): Record<string, AcpxHostTool> {
  const now = ctx.now ?? (() => Date.now())

  const parse = <T extends z.ZodType>(shape: T, input: unknown): z.infer<T> =>
    shape.parse(input)

  const refuse = (why: string): never => {
    throw new Error(why)
  }

  /**
   * Changes one of this agent's routines and gives back how it now reads.
   *
   * The re-read is the point: the agent is about to tell the person what
   * the routine does, and the row is the only thing that knows, since the
   * cron is derived and the next run is computed from it.
   */
  const change = (
    id: string,
    patch: Partial<typeof routines.$inferInsert>,
  ): RoutineView => {
    const existing = find(ctx.db, ctx.agentId, id)
    if (!existing) return refuse('No routine of yours has that id.')

    ctx.db.update(routines).set(patch).where(eq(routines.id, id)).run()

    const row = find(ctx.db, ctx.agentId, id)
    return row
      ? view(row, lastRunOf(ctx.db, row.id), now())
      : refuse('The routine was not changed.')
  }

  return {
    list_routines: {
      description:
        'List the work you already do for this person on a schedule, with ' +
        'when each one next runs and when it last ran. Call it before ' +
        'answering any question about what you do automatically, and ' +
        'before changing a routine, because you need the id. Report the ' +
        'result with explain: a short markdown table of name, when and ' +
        'next, and put the obvious next moves in its follow-up questions.',
      inputSchema: schemaOf(listShape),
      execute: () => ({ routines: listRoutines(ctx.db, ctx.agentId, now()) }),
    },

    create_routine: {
      description:
        'Set up work you will do on a schedule from now on, without being ' +
        'asked. Use it when the person says they want something to happen ' +
        'regularly. ' +
        PLAIN_CADENCE +
        ' ' +
        PROMPT_ADVICE +
        ' Report what you set up with show_work: one step, icon write, the ' +
        "routine's name as the label and the word created as the chip. If " +
        'the cadence is a real decision rather than something they already ' +
        'said, offer it with recommend first instead of guessing.',
      inputSchema: schemaOf(createShape),
      execute: (input) => {
        const draft = parse(createShape, input)
        const cadence = toCron(draft.cadence)
        if (!cadence) {
          return refuse(
            `Could not read "${draft.cadence}" as a cadence, so nothing was ` +
              'saved. Try a plainer phrase such as "every weekday at 9".',
          )
        }

        const id = `rt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
        ctx.db
          .insert(routines)
          .values({
            id,
            agentId: ctx.agentId,
            name: draft.name,
            kind: 'schedule',
            cadence: draft.cadence,
            cron: cadence.cron,
            prompt: draft.prompt,
          })
          .run()

        const row = find(ctx.db, ctx.agentId, id)
        return row
          ? view(row, null, now())
          : refuse('The routine was not saved.')
      },
    },

    update_routine: {
      description:
        'Change a routine that already exists: its name, when it runs, or ' +
        'what it does. Get the id from list_routines first. Send only what ' +
        'changes. ' +
        PLAIN_CADENCE +
        ' Report it with show_work, icon write, chip updated.',
      inputSchema: schemaOf(updateShape),
      execute: (input) => {
        const draft = parse(updateShape, input)
        const existing = find(ctx.db, ctx.agentId, draft.id)
        if (!existing) return refuse('No routine of yours has that id.')

        let cron = existing.cron
        if (draft.cadence !== undefined) {
          const cadence = toCron(draft.cadence)
          if (!cadence) {
            return refuse(
              `Could not read "${draft.cadence}" as a cadence, so nothing ` +
                'was changed.',
            )
          }
          cron = cadence.cron
        }

        return change(draft.id, {
          ...(draft.name !== undefined ? { name: draft.name } : {}),
          ...(draft.prompt !== undefined ? { prompt: draft.prompt } : {}),
          ...(draft.cadence !== undefined
            ? { cadence: draft.cadence, cron }
            : {}),
        })
      },
    },

    set_routine_enabled: {
      description:
        'Turn a routine on or off without deleting it. Off means it stops ' +
        'running and keeps everything it knows, which is the right answer ' +
        'when the person wants a pause rather than an end. A line of say is ' +
        'enough to report this; it does not need a card.',
      inputSchema: schemaOf(enabledShape),
      execute: (input) => {
        const draft = parse(enabledShape, input)
        const after = change(draft.id, { enabled: draft.enabled })
        // Same meaning as the panel's switch: on is the person saying the
        // cause is dealt with, so a parked agent gets another chance.
        if (draft.enabled) ctx.revive?.(ctx.agentId)
        return after
      },
    },

    delete_routine: {
      description:
        'Remove a routine for good, along with its history. Ask first, ' +
        'every time, using the ask tool: this cannot be undone and turning ' +
        'it off with set_routine_enabled is usually what the person ' +
        'actually wants. Say which one you mean and when it last ran, so ' +
        'they are answering about the right one. Report it afterwards with ' +
        'show_work, chip deleted.',
      inputSchema: schemaOf(deleteShape),
      execute: (input) => {
        const draft = parse(deleteShape, input)
        const existing = find(ctx.db, ctx.agentId, draft.id)
        if (!existing) return refuse('No routine of yours has that id.')

        ctx.db.delete(routines).where(eq(routines.id, draft.id)).run()
        return { deleted: true, name: existing.name }
      },
    },
  }
}
