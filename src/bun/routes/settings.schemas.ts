import { z } from 'zod'
import { agentCapabilitySchema } from './settings.agent-capability.schema'
import { agentsSchema } from './settings.custom-agent.schema'
import { mcpSchema } from './settings.mcp.schema'

export const THEME_MODES = ['light', 'dark', 'system'] as const

// Permission policy options exposed in the composer picker AND as the
// per-settings default. Order matches the dropdown's render order (safe
// options first, `allow-all` last and separated visually).
export const PERMISSION_MODES = [
  'auto-approve-reads',
  'manual',
  'read-only',
  'allow-all',
] as const
export type PermissionMode = (typeof PERMISSION_MODES)[number]

export const generalSchema = z.object({
  launchAtLogin: z.boolean(),
  minimizeToMenubarOnClose: z.boolean(),
  defaultPermissionMode: z.enum(PERMISSION_MODES),
})

export const appearanceSchema = z.object({
  theme: z.enum(THEME_MODES),
})

export const composerSchema = z.object({
  workspaces: z.object({
    default: z.string().min(1),
    recent: z.array(z.string().min(1)),
  }),
  agentCapabilities: z.record(z.string(), agentCapabilitySchema),
})

export const settingsSchema = z.object({
  general: generalSchema,
  agents: agentsSchema,
  appearance: appearanceSchema,
  composer: composerSchema,
  mcp: mcpSchema,
})

// PATCH-body schemas: validation only, no defaults — defaults belong to
// SETTINGS_DEFAULTS, otherwise `.partial()` would silently inflate a
// single-field PATCH to the full domain.
const composerPatchSchema = z.object({
  workspaces: z
    .object({
      default: z.string().min(1).optional(),
      recent: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  agentCapabilities: z.record(z.string(), agentCapabilitySchema).optional(),
})

export const patchSchema = z
  .object({
    general: generalSchema.partial().optional(),
    agents: agentsSchema.partial().optional(),
    appearance: appearanceSchema.partial().optional(),
    composer: composerPatchSchema.optional(),
    mcp: mcpSchema.partial().optional(),
  })
  .strict()

export const DOMAINS = [
  'general',
  'agents',
  'appearance',
  'composer',
  'mcp',
] as const
