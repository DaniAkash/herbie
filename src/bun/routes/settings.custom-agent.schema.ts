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
