import { z } from 'zod'

// Schemas for a single agent's probed capabilities. Kept in their own
// file so settings.ts doesn't blow past the per-file line cap as more
// probe fields land (e.g. file-content size limits in Phase 3).

const reasoningCapabilitySchema = z.object({
  key: z.string().min(1),
  values: z.array(z.string().min(1)).min(1),
  // Probed agent's own default — picker preselects this when the user
  // hasn't explicitly chosen. Optional for backward-compat with cache
  // rows written before this field landed.
  defaultValue: z.string().min(1).nullable().optional(),
})

// Each model is `{id, name?, description?}`. Older cache rows persisted
// models as a plain `string[]` — preprocess them into the new shape so
// readAll() doesn't fall over on upgrade. The freshness predicate in
// agent-capabilities.ts re-probes anything missing `promptCapabilities`
// so legacy rows get overwritten on first access.
const probedModelSchema = z.preprocess(
  (val) => (typeof val === 'string' ? { id: val } : val),
  z.object({
    id: z.string().min(1),
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  }),
)

const promptCapabilitiesSchema = z.object({
  image: z.boolean(),
  audio: z.boolean(),
  embeddedContext: z.boolean(),
})

export const agentCapabilitySchema = z.object({
  models: z.array(probedModelSchema),
  reasoning: reasoningCapabilitySchema.nullable().optional(),
  // What the agent says it can accept in user-message content. Drives
  // the composer's attachment affordance + per-message validation.
  // Optional so legacy cache rows still parse; capabilityIsFresh()
  // forces a re-probe when this is missing.
  promptCapabilities: promptCapabilitiesSchema.optional(),
  // Self-reported name from the agent's `initialize` response. Useful
  // as a fallback display label when the user picks a custom agent
  // that doesn't have a friendly name.
  agentName: z.string().nullable().optional(),
  // ms timestamp of when this entry was discovered — lets us refresh stale
  // caches without needing a separate column.
  discoveredAt: z.number().int().nonnegative(),
  // Cache-shape version. Bumped when the normalisation in
  // `resultToCapability` changes in a way that would make stored rows
  // misleading (e.g. switching the picker source from availableModels
  // to configOptions.model.options). `capabilityIsFresh` treats any
  // row without this field as legacy and forces a re-probe.
  schemaVersion: z.literal(2).optional(),
})

export const CAPABILITY_SCHEMA_VERSION = 2 as const

export type AgentProbedModel = z.infer<typeof probedModelSchema>
export type AgentPromptCapabilities = z.infer<typeof promptCapabilitiesSchema>
export type AgentReasoningCapability = z.infer<typeof reasoningCapabilitySchema>
export type AgentCapability = z.infer<typeof agentCapabilitySchema>
