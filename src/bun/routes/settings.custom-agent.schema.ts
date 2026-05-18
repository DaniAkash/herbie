import { z } from 'zod'

// A user-registered ACP agent. Id is the wire identifier (must be
// stable — referenced by chat / task / telegram rows after creation),
// command is shell-split before being passed to the acpx runtime.
// Kept in its own file so settings.ts doesn't blow past the per-file
// line cap; mirrors the settings.agent-capability.schema.ts pattern.
export const customAgentSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-z0-9][a-z0-9\-_.]*$/i,
      'Letters/digits/-/_/. only, must start with a letter or digit',
    ),
  displayName: z.string().min(1).max(64),
  command: z.string().min(1).max(2000),
  // Optional env merged into the spawned process. Stored as a list of
  // {name, value} pairs to match how MCP server env is shaped — keeps
  // form wiring consistent across the Settings tabs.
  env: z
    .array(z.object({ name: z.string().min(1), value: z.string() }))
    .optional(),
  createdAt: z.number().int().nonnegative(),
})

export type CustomAgent = z.infer<typeof customAgentSchema>

// `agents` domain — defaultAgent plus the customs list. Lives here
// (alongside customAgentSchema) so the dedupe refine can stay close to
// the schema it constrains, and so settings.ts stays under the per-file
// line cap.
//
// `customAgents` is NOT defaulted — defaults belong to SETTINGS_DEFAULTS.
// If we put `.default([])` here, `agentsSchema.partial()` (the PATCH
// schema) would silently inflate a PATCH of just `{defaultAgent}` to
// also carry `customAgents: []`, and the handler's shallow merge would
// wipe every saved custom agent.
export const agentsSchema = z.object({
  defaultAgent: z.string().min(1),
  customAgents: z.array(customAgentSchema).superRefine((arr, ctx) => {
    const seen = new Set<string>()
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i]
      if (item && seen.has(item.id)) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'id'],
          message: `Duplicate custom agent id: ${item.id}`,
        })
      }
      if (item) seen.add(item.id)
    }
  }),
})
