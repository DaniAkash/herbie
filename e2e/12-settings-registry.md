# 12 — Settings / MCP Registry

The MCP server registry. Add a server here and every new conversation picks up its tools.

## Setup

```bash
agent-browser --session e2e-mcp set viewport 1280 900
agent-browser --session e2e-mcp open http://localhost:5173/settings
agent-browser --session e2e-mcp wait --load networkidle
agent-browser --session e2e-mcp snapshot -i | grep -iE "tab.*registry"
agent-browser --session e2e-mcp click @<registry-tab-ref>
sleep 1

# Ensure registry is empty before tests
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[]}}' > /dev/null
```

---

## MCP-DEFAULT-01 — Empty registry by default

**Verification**:
```bash
curl -s http://127.0.0.1:4575/settings | jq '.mcp.servers'
# expect: []
```

```bash
agent-browser --session e2e-mcp screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/12-settings-registry/empty.png --full
# Screenshot shows the Empty block with "No servers yet" title + "Add your first server" CTA.
```

---

## MCP-PATCH-01 — stdio server PATCH round-trips

**Steps**:
```bash
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[{"id":"a","type":"stdio","name":"fs","command":"mcp-fs","args":["/tmp"],"env":[{"name":"LOG","value":"info"}]}]}}' > /dev/null
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/settings | jq '.mcp.servers[0] | {type, name, command, args, env}'
# expect:
# {
#   "type": "stdio",
#   "name": "fs",
#   "command": "mcp-fs",
#   "args": ["/tmp"],
#   "env": [{"name":"LOG","value":"info"}]
# }
```

**Cleanup**: Done in MCP-PATCH-04.

---

## MCP-PATCH-02 — http server PATCH round-trips

**Steps**:
```bash
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[{"id":"a","type":"stdio","name":"fs","command":"mcp-fs","args":[],"env":[]},{"id":"b","type":"http","name":"remote","url":"https://example.com/mcp","headers":[{"name":"Authorization","value":"Bearer x"}]}]}}' > /dev/null
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/settings | jq '.mcp.servers | length'   # expect: 2
curl -s http://127.0.0.1:4575/settings | jq '.mcp.servers[] | select(.type == "http") | .url'
# expect: "https://example.com/mcp"
```

---

## MCP-PATCH-03 — sse server PATCH round-trips

**Steps**:
```bash
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[{"id":"c","type":"sse","name":"streamer","url":"https://example.com/sse","headers":[]}]}}' > /dev/null
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/settings | jq '.mcp.servers[0].type'
# expect: "sse"
```

---

## MCP-PATCH-04 — Clear registry

**Steps**:
```bash
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[]}}' > /dev/null
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/settings | jq '.mcp.servers | length'
# expect: 0
```

---

## MCP-VALIDATE-01 — Reject duplicate names

**Steps**:
```bash
curl -s -o /dev/null -w "%{http_code}" -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[{"id":"a","type":"stdio","name":"dupe","command":"x","args":[],"env":[]},{"id":"b","type":"stdio","name":"dupe","command":"y","args":[],"env":[]}]}}'
```

**Expected**: `400`.

---

## MCP-VALIDATE-02 — Reject unknown transport

**Steps**:
```bash
curl -s -o /dev/null -w "%{http_code}" -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[{"id":"a","type":"websocket","name":"x","command":"y","args":[],"env":[]}]}}'
```

**Expected**: `400`.

---

## MCP-VALIDATE-03 — Reject non-http(s) URL

**Steps**:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[{"id":"a","type":"http","name":"x","url":"file:///etc/passwd","headers":[]}]}}'
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[{"id":"a","type":"http","name":"x","url":"ftp://example.com","headers":[]}]}}'
```

**Expected**: Both lines print `400`.

---

## MCP-VALIDATE-04 — Reject empty stdio command

**Steps**:
```bash
curl -s -o /dev/null -w "%{http_code}" -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[{"id":"a","type":"stdio","name":"x","command":"","args":[],"env":[]}]}}'
```

**Expected**: `400`.

---

## MCP-WIRE-01 — env/headers persist as arrays of {name,value}

**Goal**: The on-disk DB row matches the ACP wire format (arrays, not records). This is the workaround for the env/headers shape mismatch that was originally tracked at `DaniAkash/acpx#21`.

**Steps**:
```bash
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[{"id":"a","type":"stdio","name":"shape","command":"x","args":[],"env":[{"name":"K","value":"V"}]}]}}' > /dev/null
```

**Verification**:
```bash
bun -e "
  const { createClient } = await import('@libsql/client')
  const c = createClient({ url: 'file:' + require('node:os').homedir() + '/.herbie/data.db' })
  const r = await c.execute(\"SELECT value FROM settings WHERE key = 'mcp'\")
  const env = JSON.parse(r.rows[0].value).servers[0].env
  console.log('isArray:', Array.isArray(env), 'shape:', JSON.stringify(env))
"
# expect: isArray: true shape: [{"name":"K","value":"V"}]
```

**Cleanup**:
```bash
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[]}}' > /dev/null
```

---

## MCP-UI-ADD-01 — Add stdio server via dialog

**Goal**: Open the Add dialog, fill it for the filesystem MCP server, submit, verify the row appears.

**Preconditions**: Registry empty.

**Steps**:
```bash
agent-browser --session e2e-mcp snapshot -i | grep -iE "add.*server"
agent-browser --session e2e-mcp click @<add-server-ref>
sleep 1
agent-browser --session e2e-mcp screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/12-settings-registry/dialog-stdio.png --full

# Fill the form
agent-browser --session e2e-mcp snapshot -i | head -20
agent-browser --session e2e-mcp fill @<name-input> "filesystem"
agent-browser --session e2e-mcp fill @<command-input> "npx"
# Add three args
agent-browser --session e2e-mcp click @<add-argument-ref>
sleep 0.3
agent-browser --session e2e-mcp click @<add-argument-ref>
sleep 0.3
agent-browser --session e2e-mcp click @<add-argument-ref>
sleep 0.3
agent-browser --session e2e-mcp snapshot -i | head -20
agent-browser --session e2e-mcp fill @<arg-0> "-y"
agent-browser --session e2e-mcp fill @<arg-1> "@modelcontextprotocol/server-filesystem"
agent-browser --session e2e-mcp fill @<arg-2> "/tmp/herbie-mcp-test"
agent-browser --session e2e-mcp click @<add-server-submit>
sleep 1
agent-browser --session e2e-mcp screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/12-settings-registry/added.png --full
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/settings | jq '.mcp.servers[0] | {type, name, command, args}'
# expect:
# {
#   "type": "stdio",
#   "name": "filesystem",
#   "command": "npx",
#   "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp/herbie-mcp-test"]
# }
```

**Cleanup**: Leave the filesystem server in place — used by chat-streaming tests.

---

## MCP-UI-VALIDATION-01 — Empty name rejected client-side

**Steps**:
```bash
agent-browser --session e2e-mcp click @<add-server-button>
sleep 1
agent-browser --session e2e-mcp click @<submit-button>
sleep 0.5
agent-browser --session e2e-mcp screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/12-settings-registry/empty-name-error.png --full
```

**Expected**: Form stays open; "Required" error appears under Name field.

**Verification**: Inspect screenshot. The settings PATCH should not have fired (verify via `curl /settings | jq '.mcp.servers | length'` — count unchanged).

**Cleanup**:
```bash
agent-browser --session e2e-mcp click @<cancel-button>
```

---

## MCP-UI-VALIDATION-02 — Whitespace-only name rejected

**Goal**: `'   '` (three spaces) doesn't bypass client validation by trim-then-empty.

**Steps**:
```bash
agent-browser --session e2e-mcp click @<add-server-button>
sleep 1
agent-browser --session e2e-mcp fill @<name-input> "   "
agent-browser --session e2e-mcp fill @<command-input> "x"
agent-browser --session e2e-mcp click @<submit-button>
sleep 0.5
```

**Expected**: "Required" error on Name field; form does not submit.

**Cleanup**:
```bash
agent-browser --session e2e-mcp click @<cancel-button>
```

---

## MCP-UI-TRANSPORT-01 — Switching transport swaps body fields

**Steps**:
```bash
agent-browser --session e2e-mcp click @<add-server-button>
sleep 1
agent-browser --session e2e-mcp snapshot -i | grep -E "stdio|http|sse"
agent-browser --session e2e-mcp click @<http-toggle-ref>
sleep 0.5
agent-browser --session e2e-mcp screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/12-settings-registry/transport-http.png --full
```

**Expected**: Command/Args/Env disappear; URL + Headers appear.

**Verification**:
```bash
agent-browser --session e2e-mcp snapshot -i | grep -iE "url|headers|command" | head
# expect lines containing "URL" and "Headers" but NOT "Command"
```

**Cleanup**:
```bash
agent-browser --session e2e-mcp click @<cancel-button>
```

---

## MCP-UI-EDIT-01 — Edit pre-populates the form

**Preconditions**: At least one server in the registry (run MCP-UI-ADD-01 first).

**Steps**:
```bash
agent-browser --session e2e-mcp snapshot -i | grep -E "Edit server"
agent-browser --session e2e-mcp click @<edit-icon-ref>
sleep 1
agent-browser --session e2e-mcp screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/12-settings-registry/edit-prepopulated.png --full
```

**Expected**: Dialog title says "Edit MCP server"; name + command + args fields are pre-filled with the existing server's values.

**Verification**:
```bash
agent-browser --session e2e-mcp eval "document.querySelector('#mcp-name')?.value"
# expect: "filesystem" (or whatever name was added)
```

**Cleanup**:
```bash
agent-browser --session e2e-mcp click @<cancel-button>
```

---

## MCP-UI-REMOVE-01 — Trash icon removes the server

**Preconditions**: One server in the registry.

**Steps**:
```bash
agent-browser --session e2e-mcp snapshot -i | grep -E "Remove server"
agent-browser --session e2e-mcp click @<trash-icon-ref>
sleep 0.5
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/settings | jq '.mcp.servers | length'
# expect: 0
```

**Note**: No confirmation in v1 (out of scope). If you accidentally remove a heavily-configured server, no undo. Tracked as a follow-up.

**Cleanup**: Re-add the filesystem server if chat tests will run next (see MCP-UI-ADD-01).

---

## Teardown

```bash
# Leave the filesystem server in place for 21-chat-streaming.md if running sequentially.
# Otherwise:
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[]}}' > /dev/null
agent-browser --session e2e-mcp close
```
