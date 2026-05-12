import { fileURLToPath } from 'node:url'
import type { McpServerSpec } from '../chat/acpxProvider'

// Build the McpServerSpec acpx hands to the agent. The agent will
// stdio-spawn the script as a child process; the child reads the
// env vars below and POSTs the markdown back to Herbie's loopback
// HTTP route.
//
// Server name is `herbie`. Combined with the tool name `task_result`,
// the agent will see this surface as `herbie__task_result` (claude's
// MCP namespacing convention). If a specific agent surfaces a
// different shape, the SCHEDULED_RUN_SYSTEM_PROMPT constant is the
// single source of truth to update.
export function taskResultServerSpec(
  token: string,
  apiBaseUrl: string,
): McpServerSpec {
  return {
    type: 'stdio',
    name: 'herbie',
    command: process.execPath,
    args: [resolveScriptPath()],
    env: [
      { name: 'HERBIE_API_BASE', value: apiBaseUrl },
      { name: 'HERBIE_RUN_TOKEN', value: token },
    ],
  }
}

// `import.meta.url` resolves at runtime to the bundled location:
//   Herbie.app/Contents/Resources/app/bun/index.js
// electrobun.config.ts's copy directive
//   'src/bun/tasks/mcp-task-result': 'mcp-task-result'
// lands the script at Resources/app/mcp-task-result/index.ts, which
// is one directory level up from index.js (URL `..` resolves against
// the parent of the resource itself).
//
// Same shape as src/db/index.ts's migrationsFolder() — keep them in
// sync if the Electrobun layout changes.
function resolveScriptPath(): string {
  return fileURLToPath(new URL('../mcp-task-result/index.ts', import.meta.url))
}
