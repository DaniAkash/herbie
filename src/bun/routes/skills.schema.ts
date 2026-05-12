import { z } from 'zod'

export const HERBIE_SKILLS_AGENT_ENUM = z.enum(['claude', 'codex', 'gemini'])

const sourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('github'),
    ownerRepo: z.string(),
    ref: z.string().optional(),
  }),
  z.object({
    kind: z.literal('gitUrl'),
    url: z.string(),
    ref: z.string().optional(),
  }),
  z.object({
    kind: z.literal('local'),
    path: z.string(),
  }),
])

export const skillRowSchema = z.object({
  // Sanitized workspace dir name — also the lookup key for link / unlink /
  // remove. Round-trips through the package per its docs.
  name: z.string(),
  description: z.string(),
  workspacePath: z.string(),
  source: sourceSchema.optional(),
  addedAt: z.string().optional(),
  broken: z.boolean().optional(),
})

export const linkRowSchema = z.object({
  skillName: z.string(),
  agent: HERBIE_SKILLS_AGENT_ENUM,
  linkPath: z.string(),
  broken: z.boolean().optional(),
})

export const skillsStateSchema = z.object({
  skills: z.array(skillRowSchema),
  links: z.array(linkRowSchema),
})

export const addBodySchema = z.object({
  source: z.string().min(1),
  skillNames: z.union([z.literal('*'), z.array(z.string().min(1))]).optional(),
})

export const linkBodySchema = z.object({
  agent: HERBIE_SKILLS_AGENT_ENUM,
})

export const rescanBodySchema = z
  .object({ mode: z.enum(['merge', 'replace']).default('merge') })
  .optional()
