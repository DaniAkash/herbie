import { z } from 'zod'
import { PERMISSION_MODES } from './settings'

// agentId is free-form at the schema level; runtime validation against
// the live registry happens inside each handler via the shared
// validateAgentId helper so Phase 2's custom agents are accepted
// without revisiting these validators.
const agentIdField = z.string().min(1)

// Tuple fields are optional on every endpoint — clients may omit them
// (e.g. /chat without modelId) and we fall back to the agent default or
// the conversation row's persisted value.
const tupleFields = {
  modelId: z.string().min(1).nullish(),
  workspacePath: z.string().min(1).nullish(),
  reasoningEffort: z.string().min(1).nullish(),
} as const

export const createSchema = z
  .object({
    agentId: agentIdField,
    title: z.string().min(1).max(200).optional(),
    ...tupleFields,
    permissionMode: z.enum(PERMISSION_MODES).optional(),
  })
  .strict()

export const sendSchema = z
  .object({
    text: z.string().min(1),
    agentId: agentIdField.optional(),
    attachmentIds: z.array(z.string().min(1)).default([]),
    ...tupleFields,
  })
  .strict()

export const cancelSchema = z.object({ reason: z.string().optional() }).strict()

export const conversationQuery = z
  .object({ afterSeq: z.string().optional() })
  .optional()

// PATCH /chat/:id accepts a title rename, a pin/unpin toggle, or any
// subset of the composer tuple fields. At least one field must be
// present.
export const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    pinned: z.boolean().optional(),
    agentId: agentIdField.optional(),
    ...tupleFields,
    permissionMode: z.enum(PERMISSION_MODES).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.title !== undefined ||
      v.pinned !== undefined ||
      v.agentId !== undefined ||
      v.modelId !== undefined ||
      v.workspacePath !== undefined ||
      v.reasoningEffort !== undefined ||
      v.permissionMode !== undefined,
    { message: 'patch must include at least one field' },
  )

export const permissionDecisionSchema = z
  .object({
    outcome: z.enum([
      'allow_once',
      'allow_always',
      'reject_once',
      'reject_always',
    ]),
  })
  .strict()
