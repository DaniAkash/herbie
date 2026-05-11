# 11 — Settings / Agents

Agent detection three-state UI (installed / npx-available / not-installed) and the default-agent picker.

## Setup

```bash
agent-browser --session e2e-agents set viewport 1280 900
agent-browser --session e2e-agents open http://localhost:5173/settings
agent-browser --session e2e-agents wait --load networkidle
# Click the Agents tab (locate via snapshot)
agent-browser --session e2e-agents snapshot -i | grep -iE "tab.*agents"
agent-browser --session e2e-agents click @<agents-tab-ref>
sleep 1
agent-browser --session e2e-agents screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/11-settings-agents/setup.png --full
```

---

## AGENTS-DETECT-01 — Detection endpoint returns all acpx-enumerated agents

**Goal**: `GET /agents` returns the full acpx runtime list (not just the four "primary" agents).

**Steps**:
```bash
curl -s http://127.0.0.1:4575/agents | jq 'length'
```

**Expected**: 17 (16 acpx built-ins + hermes via Herbie override). Number may shift as acpx adds agents — verify `>= 16`.

**Verification**:
```bash
curl -s http://127.0.0.1:4575/agents | jq 'length >= 16'
# expect: true
curl -s http://127.0.0.1:4575/agents | jq -r '.[] | .agentId' | grep -E "^(claude|codex|gemini|hermes)$" | wc -l | tr -d ' '
# expect: 4 (all primaries present)
```

**Cleanup**: None.

---

## AGENTS-DETECT-02 — Each agent has display name + install URL

**Goal**: Every detection row has a human display name + valid install URL (display overlay in `agent-display.ts` fills gaps acpx itself doesn't).

**Verification**:
```bash
curl -s http://127.0.0.1:4575/agents | \
  jq '.[] | select(.displayName == null or .installUrl == null)' | head
# expect: empty output (no row missing either field)

curl -s http://127.0.0.1:4575/agents | \
  jq -r '.[] | .installUrl' | grep -vE "^https?://" | head
# expect: empty output (all URLs are http(s))
```

**Cleanup**: None.

---

## AGENTS-UI-01 — Three sections render with the right buckets

**Goal**: The Agents tab groups detection rows into Installed / Auto-installs via npx / Not installed on this machine.

**Steps**:
```bash
agent-browser --session e2e-agents screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/11-settings-agents/buckets.png --full
```

**Expected**: Screenshot shows up to three section headings ("Installed", "Auto-installs via npx", "Not installed on this machine") — sections with zero rows are hidden.

**Verification**:
```bash
# Confirm at least Claude Code is in Installed (per ENV-AGENT-01).
curl -s http://127.0.0.1:4575/agents | jq '.[] | select(.agentId == "claude") | .installState'
# expect: "installed" (or "npx-available" depending on install method)
```

**Cleanup**: None.

---

## AGENTS-NOT-INSTALLED-01 — Install button opens external browser

**Goal**: Clicking "Install →" on a not-installed row calls `POST /open-external` and the OS opens the URL in the default browser.

**Steps**:
```bash
agent-browser --session e2e-agents snapshot -i | grep -E "Install" | head
# Click an Install button:
agent-browser --session e2e-agents click @<install-button-ref>
sleep 1
```

**Expected**: A new browser window/tab opens in the user's default browser pointing at the agent's install URL.

**Verification**:
```bash
# Sanity-check the endpoint is wired:
curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:4575/open-external \
  -H "Content-Type: application/json" -d '{"url":"https://example.com"}'
# expect: 200
curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:4575/open-external \
  -H "Content-Type: application/json" -d '{"url":"file:///etc/passwd"}'
# expect: 400 (only http(s) allowed)
```

**Cleanup**: Close the spurious browser window.

---

## AGENTS-PICKER-01 — Default-agent picker shows only installed primaries

**Goal**: The "Default agent for new chats" `ToggleGroup` lists only `installed` + `npx-available` primary agents (claude/codex/gemini/hermes). Not-installed primaries don't appear in the picker.

**Steps**:
```bash
agent-browser --session e2e-agents snapshot -i | grep -E "button.*(Claude|Codex|Gemini|Hermes)"
# Count installed primaries from the API:
curl -s http://127.0.0.1:4575/agents | jq -r '
  .[] | select(.agentId == "claude" or .agentId == "codex" or .agentId == "gemini" or .agentId == "hermes")
  | select(.installState != "not-installed") | .agentId' | wc -l | tr -d ' '
```

**Expected**: The number of ToggleGroupItem entries in the picker equals the count from the API query.

**Verification**: Match the two numbers.

**Cleanup**: None.

---

## AGENTS-PICKER-02 — Selecting a default agent persists

**Goal**: Clicking a different default agent writes to settings and survives a reload.

**Preconditions**: At least two installed primary agents. If only one is installed, mark this test SKIP.

**Steps**:
```bash
# Pick whichever installed primary isn't the current default. Snapshot to locate
# refs, then click. Replace <other-agent-ref> below.
curl -s http://127.0.0.1:4575/settings | jq '.agents.defaultAgent'   # capture current
agent-browser --session e2e-agents click @<other-agent-ref>
sleep 0.5
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/settings | jq '.agents.defaultAgent'
# expect: the newly-selected agentId

# Reload + confirm persists
agent-browser --session e2e-agents open http://localhost:5173/settings
agent-browser --session e2e-agents wait --load networkidle
agent-browser --session e2e-agents click @<agents-tab-ref>
# The newly-selected agent should still appear as the active toggle in the picker.
```

**Cleanup**:
```bash
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"agents":{"defaultAgent":"claude"}}' > /dev/null
```

---

## AGENTS-PICKER-03 — Empty-state copy when no primary is installed

**Goal**: If none of claude/codex/gemini/hermes is installed/npx-available, the picker is replaced by an "Install one of the supported agents below to set a default." hint.

**Note**: Requires a machine without any primary agent. Typically you can't verify this on a dev box. Mark `[MANUAL]` or skip in CI.

**Steps**: Uninstall all primary agents (impractical) → reload → check copy.

**Cleanup**: None.

---

## Teardown

```bash
agent-browser --session e2e-agents close
```
