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
export const AGENT_SHAPES = [
  'squircle',
  'circle',
  'soft-hexagon',
  'pill',
  'rounded-diamond',
  'soft-trapezoid',
  'rounded-arch',
] as const

const COLORS = ['ops', 'scout', 'post', 'mail', 'house', 'watch'] as const

export const createAgentBody = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.enum(COLORS),
  shape: z.enum(AGENT_SHAPES).default('squircle'),
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
  shape: z.enum(AGENT_SHAPES).optional(),
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

export const turnBody = z.object({
  text: z.string().trim().min(1).max(8000),
})

export const cancelBody = z.object({
  reason: z.string().trim().max(200).optional(),
})

/**
 * The answers to an `ask` block, by question index.
 *
 * Indices as keys rather than an array, because a question the person
 * skipped has no entry at all and an array would need a hole in it.
 */
export const answersBody = z.object({
  answers: z.record(z.string(), z.array(z.number().int().min(0)).max(6)),
})

export const decisionBody = z.object({
  /** The agent's own option id, taken from the record it was offered on. */
  optionId: z.string().trim().min(1),
  /** The record the option was offered on, which the decision references. */
  recordId: z.string().trim().min(1),
})

/** How far the reader has got. -1, or absent, means the whole thread. */
export const afterQuery = z.object({
  after: z.coerce.number().int().optional(),
})

/** What the window is looking at, reported so the sidecar can stay quiet about it. */
export const presenceBody = z.object({
  focused: z.boolean(),
  agentId: z.string().trim().min(1).nullish(),
})

/** One setting, written by key. Values are strings; the reader owns the shape. */
export const settingBody = z.object({
  value: z.string().max(2000),
})
