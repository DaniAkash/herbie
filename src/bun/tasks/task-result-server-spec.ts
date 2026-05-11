import path from 'node:path'
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

// Both `bun run dev:hmr` and the packaged Electrobun build run from
// inside `Herbie-dev.app/Contents/MacOS` (or `.../Contents/Resources/`
// depending on the platform). `process.execPath` is the bundled bun;
// the MCP child script is copied to `Contents/Resources/mcp-task-result`
// at build time (see electrobun.config.ts).
function resolveScriptPath(): string {
  const execDir = path.dirname(process.execPath)
  // On macOS: execPath = .../Contents/MacOS/bun
  //           resources = .../Contents/Resources
  return path.join(execDir, '..', 'Resources', 'mcp-task-result', 'index.ts')
}
