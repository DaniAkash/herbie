import { z } from 'zod'

/**
 * The request shapes, named once for both ends.
 *
 * Shared rather than server only because the forms validate against the same
 * definitions the routes enforce. Two copies of a rule drift, and the copy
 * that drifts is always the one in the form, which then lets through a body
 * the server rejects with a message nobody wrote for a person to read.
 */

/** The six face colours. Identity only, never an accent. */
const COLORS = ['ops', 'scout', 'post', 'mail', 'house', 'watch'] as const

export const createAgentBody = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.enum(COLORS),
  brief: z.string().max(4000).default(''),
  acpAgent: z.string().trim().min(1),
  model: z.string().nullish(),
  effort: z.string().trim().min(1).default('medium'),
  workspaceDir: z.string().trim().nullish(),
})

/** The name a folder is being planned for, before the agent exists. */
export const workspaceQuery = z.object({
  name: z.string().trim().min(1).max(60),
})

export const patchAgentBody = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: z.enum(COLORS).optional(),
  brief: z.string().max(4000).optional(),
  acpAgent: z.string().trim().min(1).optional(),
  model: z.string().nullish(),
  effort: z.string().trim().min(1).optional(),
  workspaceDir: z.string().trim().min(1).optional(),
  autonomy: z.enum(['ask', 'auto']).optional(),
  askOnTelegram: z.boolean().optional(),
  telegramResults: z.boolean().optional(),
  telegramBot: z.string().nullish(),
  enabled: z.boolean().optional(),
})

export const createRoutineBody = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['schedule', 'event']).default('schedule'),
  cadence: z.string().trim().min(1).max(200),
  prompt: z.string().max(4000).default(''),
  deliverTelegram: z.boolean().default(false),
})

export const patchRoutineBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  kind: z.enum(['schedule', 'event']).optional(),
  cadence: z.string().trim().min(1).max(200).optional(),
  prompt: z.string().max(4000).optional(),
  deliverTelegram: z.boolean().optional(),
  enabled: z.boolean().optional(),
})

export const createRuleBody = z.object({
  kind: z.enum(['ask', 'allow']),
  phrase: z.string().trim().min(1).max(120),
})

export const accessBody = z.object({
  kind: z.enum(['server', 'skill']),
  refId: z.string().trim().min(1),
  enabled: z.boolean(),
})

export const cadenceBody = z.object({
  text: z.string().trim().max(200),
})
