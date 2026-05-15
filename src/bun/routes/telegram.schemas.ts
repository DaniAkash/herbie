import { z } from 'zod'
import { agentIdField } from './tasks.schemas'

// The 4 tuple fields are pinned at creation — see resolved decision 3
// in the plan. Edits use a separate schema that omits all of them.
export const createConnectionSchema = z
  .object({
    name: z.string().min(1).max(120),
    botToken: z
      .string()
      .min(20)
      .max(80)
      .regex(/^\d+:[A-Za-z0-9_-]+$/, 'Tokens look like 123456:ABC-DEF…'),
    agentId: agentIdField,
    modelId: z.string().min(1).nullish(),
    workspacePath: z.string().min(1),
    reasoningEffort: z.string().min(1).nullish(),
  })
  .strict()

export const updateConnectionSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    // Empty / undefined means "keep existing"; submitting a new token
    // re-validates against getMe and restarts the bot.
    botToken: z
      .string()
      .min(20)
      .max(80)
      .regex(/^\d+:[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .strict()
