#!/usr/bin/env bun
// herbie__task_result MCP server.
//
// Spawned per scheduled-task run by the agent (via acpx). Exposes one
// tool — task_result(markdown) — that POSTs the markdown back to
// Herbie's loopback /internal/task-result/<token> route. The token +
// API base land via env vars set when TaskRunSession builds the
// McpServerSpec.
//
// Intentionally tiny: no logic beyond "deliver markdown, return short
// acknowledgement so the agent stops cleanly." All state + the
// run row update happen on the Herbie side after the POST lands.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import * as z from 'zod/v4'

// biome-ignore-start lint/style/noProcessEnv: spawned by acpx with
//   token/base injected via env; this is the contract. There is no
//   config file to read from.
const apiBase = process.env.HERBIE_API_BASE
const token = process.env.HERBIE_RUN_TOKEN
// biome-ignore-end lint/style/noProcessEnv: see above

if (!apiBase || !token) {
  process.stderr.write(
    '[herbie__task_result] missing HERBIE_API_BASE or HERBIE_RUN_TOKEN env vars\n',
  )
  process.exit(2)
}

const server = new McpServer(
  { name: 'herbie', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

// MCP SDK's `inputSchema` accepts `Record<string, AnySchema>` where
// AnySchema = z3.ZodTypeAny | z4.$ZodType. Our zod v4 ZodString IS a
// $ZodType at runtime, but TS structural matching picks the v3 arm
// of the union first and reports a v3-shape mismatch. Cast through
// the SDK's own union-aware record type.
const inputShape = {
  markdown: z
    .string()
    .min(1)
    .describe(
      'The complete brief in GitHub-flavoured markdown. Start headings ' +
        'at H2 (`##`). Be a brief, not a transcript — lead with the answer.',
    ),
} as unknown as ZodRawShapeCompat

server.registerTool(
  'task_result',
  {
    title: 'Deliver task result',
    description:
      'Deliver the final markdown brief for this scheduled task. ' +
      'Call exactly once, at the very end, with the complete answer. ' +
      'The user only sees the markdown you pass here — anything you ' +
      'say outside this tool call is internal.',
    inputSchema: inputShape,
  },
  async (args) => {
    const markdown = String((args as { markdown?: unknown }).markdown ?? '')
    const res = await fetch(
      `${apiBase}/internal/task-result/${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ markdown }),
      },
    ).catch((err: unknown) => {
      // Network error reaching Herbie — surface to the agent so it
      // doesn't claim success. The run will fall back to text capture.
      throw new Error(
        `task_result: failed to reach Herbie at ${apiBase}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(
        `task_result: Herbie rejected delivery (${res.status}): ${body || res.statusText}`,
      )
    }
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Result delivered. You may stop now — the user has your brief.',
        },
      ],
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
