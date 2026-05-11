# 22 — Chat / Composer pickers

The composer dropdowns: agent, workspace, model, reasoning-effort. Each must persist its choice into the conversation row and survive a reload.

## Setup

```bash
agent-browser --session e2e-pickers set viewport 1280 900
agent-browser --session e2e-pickers open http://localhost:5173/chat/new
agent-browser --session e2e-pickers wait --load networkidle
```

---

## PICKERS-AGENT-01 — Agent picker shows installed agents only

**Steps**:
```bash
agent-browser --session e2e-pickers snapshot -i | head -30
# Locate the agent picker button (label contains the current agent name, e.g. "Claude Code")
agent-browser --session e2e-pickers click @<agent-picker-ref>
sleep 0.5
agent-browser --session e2e-pickers screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/22-chat-pickers/agent-menu.png --full
```

**Expected**: Dropdown shows only agents whose detection state is `installed` or `npx-available`. Not-installed agents aren't in the list.

**Verification**:
```bash
curl -s http://127.0.0.1:4575/agents | jq -r '.[] | select(.installState != "not-installed") | .agentId' | sort
# expect: this list matches the agents in the dropdown
```

**Cleanup**: Click outside the dropdown to dismiss.

---

## PICKERS-AGENT-02 — Switching agent persists when conversation starts

**Steps**:
```bash
agent-browser --session e2e-pickers click @<agent-picker-ref>
agent-browser --session e2e-pickers snapshot -i | grep -iE "claude|codex|gemini"
agent-browser --session e2e-pickers click @<non-default-agent-ref>
sleep 0.3
agent-browser --session e2e-pickers fill @<composer-ref> "say hi in one word"
agent-browser --session e2e-pickers press Enter
sleep 10
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/chat | jq '.[0].agentId'
# expect: the agent id you selected
```

**Cleanup**:
```bash
CONV=$(curl -s http://127.0.0.1:4575/chat | jq -r '.[0].id')
curl -s -X DELETE "http://127.0.0.1:4575/chat/$CONV" > /dev/null
```

---

## PICKERS-WORKSPACE-01 — Workspace picker lists default + recents

**Steps**:
```bash
agent-browser --session e2e-pickers open http://localhost:5173/chat/new
agent-browser --session e2e-pickers wait --load networkidle
agent-browser --session e2e-pickers snapshot -i | head -30
# Find the workspace picker (label is the current workspace directory name, e.g. "herbie-workspace")
agent-browser --session e2e-pickers click @<workspace-picker-ref>
sleep 0.5
agent-browser --session e2e-pickers screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/22-chat-pickers/workspace-menu.png --full
```

**Expected**: Default workspace at top, then "Recent workspaces" (if any), then a "Pick directory…" option.

**Verification**:
```bash
curl -s http://127.0.0.1:4575/settings | jq '{default: .composer.workspaces.default, recent: .composer.workspaces.recent}'
# expect: default path matches the top item; recent list matches the dropdown's recents
```

**Cleanup**: Click outside to dismiss.

---

## PICKERS-MODEL-01 — Model picker hides when agent has no models

**Goal**: The model picker only appears for agents that advertise a list of models (Codex does; Claude doesn't expose one to acpx-ai-provider today).

**Steps**:
```bash
# Select an agent without models (e.g. Claude Code)
agent-browser --session e2e-pickers open http://localhost:5173/chat/new
agent-browser --session e2e-pickers wait --load networkidle
# Set default agent to claude via API to avoid UI flap
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"agents":{"defaultAgent":"claude"}}' > /dev/null
agent-browser --session e2e-pickers open http://localhost:5173/chat/new
agent-browser --session e2e-pickers wait --load networkidle
agent-browser --session e2e-pickers snapshot -i | grep -iE "model" | head
```

**Expected**: No "model" picker visible for Claude.

```bash
# Switch to Codex (if installed) — model picker should appear
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"agents":{"defaultAgent":"codex"}}' > /dev/null
agent-browser --session e2e-pickers open http://localhost:5173/chat/new
agent-browser --session e2e-pickers wait --load networkidle
agent-browser --session e2e-pickers snapshot -i | grep -iE "model" | head
```

**Expected (Codex)**: A model picker now appears alongside the agent picker.

**Cleanup**:
```bash
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"agents":{"defaultAgent":"claude"}}' > /dev/null
```

---

## PICKERS-REASONING-01 — Reasoning-effort picker appears for capable agents

**Goal**: When the active agent advertises a `reasoning` capability key (e.g. Codex via Responses-API `reasoning.effort`), the composer shows a reasoning effort picker.

**Steps**:
```bash
# Switch to Codex (assumes installed)
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"agents":{"defaultAgent":"codex"}}' > /dev/null
agent-browser --session e2e-pickers open http://localhost:5173/chat/new
agent-browser --session e2e-pickers wait --load networkidle
sleep 1
agent-browser --session e2e-pickers screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/22-chat-pickers/reasoning-codex.png --full
agent-browser --session e2e-pickers snapshot -i | grep -iE "default|reasoning|low|medium|high"
```

**Expected**: A picker labeled with the reasoning effort (e.g. "Default") appears next to the model picker.

**Verification**:
```bash
# Capability cache for codex should include a reasoning.key
curl -s http://127.0.0.1:4575/settings | jq '.composer.agentCapabilities.codex.reasoning'
# expect: non-null with a "key" field
```

**Cleanup**:
```bash
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"agents":{"defaultAgent":"claude"}}' > /dev/null
```

---

## PICKERS-PERSISTENCE-01 — Tuple persists on the conversation row

**Goal**: The agent/workspace/model/reasoning tuple selected at send-time is recorded on the conversation row and survives reload.

**Steps**:
```bash
agent-browser --session e2e-pickers open http://localhost:5173/chat/new
agent-browser --session e2e-pickers wait --load networkidle
# Configure pickers via UI (or via PATCH for speed):
agent-browser --session e2e-pickers snapshot -i | grep -iE "ask anything"
agent-browser --session e2e-pickers fill @<composer-ref> "hi"
agent-browser --session e2e-pickers press Enter
sleep 10
CONV=$(curl -s http://127.0.0.1:4575/chat | jq -r '.[0].id')
```

**Verification**:
```bash
curl -s "http://127.0.0.1:4575/chat/$CONV" | jq '.conversation | {agentId, workspacePath, modelId, reasoningEffort}'
# expect: every field set (modelId / reasoningEffort may be null if the agent doesn't expose them)
```

**Cleanup**:
```bash
curl -s -X DELETE "http://127.0.0.1:4575/chat/$CONV" > /dev/null
```

---

## Teardown

```bash
agent-browser --session e2e-pickers close
```
