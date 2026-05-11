// The loopback port the bun-side Hono API binds on. Defined here so
// internal-spawned processes (e.g. the herbie__task_result MCP child)
// can reach back to the same Herbie process without circular-importing
// the entry file.
export const API_PORT = 4575

export const API_BASE_URL = `http://127.0.0.1:${API_PORT}`
