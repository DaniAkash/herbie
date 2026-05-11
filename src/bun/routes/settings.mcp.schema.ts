import { z } from 'zod'

// ACP's wire format for env / headers is [{name, value}], not a record.
// See https://github.com/DaniAkash/acpx/issues/21 — the provider's public
// types claim records but the runtime parses arrays. Store + send arrays.
const namedValueSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
})

const mcpServerStdioSchema = z.object({
  id: z.string().min(1),
  type: z.literal('stdio'),
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()),
  env: z.array(namedValueSchema),
})

const mcpServerHttpSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['http', 'sse']),
  name: z.string().min(1),
  url: z
    .url()
    .refine((u) => /^https?:\/\//i.test(u), 'only http(s) URLs are allowed'),
  headers: z.array(namedValueSchema),
})

const mcpServerSchema = z.discriminatedUnion('type', [
  mcpServerStdioSchema,
  mcpServerHttpSchema,
])

export const mcpSchema = z.object({
  servers: z
    .array(mcpServerSchema)
    .refine(
      (servers) => new Set(servers.map((s) => s.name)).size === servers.length,
      { message: 'MCP server names must be unique' },
    ),
})
