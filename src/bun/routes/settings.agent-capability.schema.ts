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
  // Config key the model selector is actually registered under. Agents
  // expose it under either the `model` or the `model_config` category,
  // so `setConfigOption` has to be told which. Null when the agent
  // advertises no selector; callers fall back to "model".
  modelConfigId: z.string().min(1).nullable().optional(),
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
  // misleading. Version 3 exists because the probe now derives models
  // from the settable selector: rows written before it can hold
  // advertised-only ids that `setConfigOption` rejects, which strands a
  // conversation on a model the agent will not honour.
  //
  // Deliberately any non-negative int rather than a literal. This
  // schema validates persisted settings through an unguarded parse, so
  // pinning it to the current version would make every row written by
  // an older build throw on load instead of re-probing. Staleness is
  // `capabilityIsFresh`'s job; this field only has to round-trip.
  schemaVersion: z.number().int().nonnegative().optional(),
})

export const CAPABILITY_SCHEMA_VERSION = 3 as const

export type AgentProbedModel = z.infer<typeof probedModelSchema>
export type AgentPromptCapabilities = z.infer<typeof promptCapabilitiesSchema>
export type AgentReasoningCapability = z.infer<typeof reasoningCapabilitySchema>
export type AgentCapability = z.infer<typeof agentCapabilitySchema>

/**
 * Config key to pass to `setConfigOption` when changing the model.
 * Falls back to the historical literal for rows written before the
 * selector key was probed, and for agents that advertise no selector.
 */
export function modelConfigKey(
  cap: Pick<AgentCapability, 'modelConfigId'> | null | undefined,
): string {
  return cap?.modelConfigId ?? 'model'
}
