# 00 — Environment setup

One-time setup at the start of every test pass. Run these in order. If any step fails, stop and fix before running the feature tests.

---

## ENV-PORTS-01 — Ensure ports are free

**Goal**: API (`4575`) and Vite (`5173`) aren't held by a stale process.

**Steps**:
```bash
lsof -nP -iTCP:4575 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

**Expected**: Either no output (ports free) OR rows whose `COMMAND` paths resolve to the branch you intend to test.

**Cleanup**: If a stale process holds a port, identify the PID and quit it via the menubar (preferred) or `kill <pid>` (last resort).

---

## ENV-LAUNCH-01 — Launch Herbie + Vite

**Goal**: Renderer reachable at `http://localhost:5173`, API healthy at `http://127.0.0.1:4575`.

**Preconditions**: Ports free (ENV-PORTS-01).

**Steps**:
```bash
cd ~/workbench/worktrees/DaniAkash/herbie/<branch-under-test>
bun install
bun x vite --port 5173 &
disown
sleep 4
bun start &
disown
sleep 15
```

**Expected**: Both processes running; Herbie window opens on macOS.

**Verification**:
```bash
curl -s http://localhost:5173 -I | head -1   # → HTTP/1.1 200 OK
curl -s http://127.0.0.1:4575/health         # → {"status":"ok"}
ps -p $(lsof -nP -iTCP:4575 -sTCP:LISTEN -t) -o command= | grep -q "<branch-under-test>" && echo "API on test branch" || echo "WRONG BRANCH"
```

**Cleanup**: Leave running for the rest of the pass.

---

## ENV-AGENT-01 — Confirm Claude Code is installed + authenticated

**Goal**: At least one ACP agent works. Any chat-touching test needs this.

**Steps**:
```bash
curl -s http://127.0.0.1:4575/agents | jq '.[] | select(.agentId == "claude") | {installState, version, acpReady}'
```

**Expected**:
```json
{
  "installState": "installed",
  "version": "...",   // any string is fine
  "acpReady": true
}
```

**Verification**: `acpReady` is `true`.

**Cleanup**: None.

---

## ENV-MCP-DATA-01 — Seed the MCP test directory

**Goal**: `/tmp/herbie-mcp-test` exists with two files so the filesystem MCP server has something to list during chat tests.

**Steps**:
```bash
mkdir -p /tmp/herbie-mcp-test
echo "hello from herbie test" > /tmp/herbie-mcp-test/hello.txt
echo "second file" > /tmp/herbie-mcp-test/notes.md
```

**Verification**:
```bash
ls -la /tmp/herbie-mcp-test/
# expect: hello.txt, notes.md
```

**Cleanup**: Not required between tests — files are idempotent.

---

## ENV-SETTINGS-01 — Snapshot starting settings

**Goal**: Capture the user's settings BEFORE the pass so 90-cleanup can restore them.

**Steps**:
```bash
curl -s http://127.0.0.1:4575/settings > /tmp/herbie-e2e-settings-baseline.json
echo "snapshot saved"
```

**Verification**:
```bash
jq 'keys' /tmp/herbie-e2e-settings-baseline.json
# expect: ["agents","appearance","composer","general","mcp"]
```

**Cleanup**: Keep the file until 90-cleanup runs.

---

## ENV-SCREENSHOTS-01 — Prepare screenshot directories

**Goal**: Per-doc screenshot folders exist for the duration of the pass.

**Steps**:
```bash
mkdir -p ~/workbench/screenshots/DaniAkash/herbie/e2e/{10-settings-general,11-settings-agents,12-settings-registry,13-settings-app-menu,20-chat-basic,21-chat-streaming,22-chat-pickers,30-tasks,40-inbox}
```

**Verification**:
```bash
ls ~/workbench/screenshots/DaniAkash/herbie/e2e/ | wc -l
# expect: 9
```

**Cleanup**: Leave in place; screenshots are evidence.

---

## ENV-BROWSER-01 — Initial agent-browser session

**Goal**: First load of the renderer in a managed browser session.

**Steps**:
```bash
agent-browser --session e2e-bootstrap set viewport 1280 900
agent-browser --session e2e-bootstrap open http://localhost:5173
agent-browser --session e2e-bootstrap wait --load networkidle
agent-browser --session e2e-bootstrap screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/env-home.png --full
agent-browser --session e2e-bootstrap close
```

**Expected**: Screenshot shows the chat home page ("What's on your mind?") with the sidebar populated.

**Verification**: Inspect the screenshot manually — if the home renders, the renderer + API are wired correctly.

**Cleanup**: Session closed.
