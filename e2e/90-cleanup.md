# 90 — Cleanup

Restore the system to its pre-pass state. Run after the full test pass — or if you bail mid-pass and want a clean slate.

---

## CLEANUP-SESSIONS-01 — Close all agent-browser sessions

**Steps**:
```bash
agent-browser close --all
```

**Verification**:
```bash
agent-browser session list
# expect: empty
```

---

## CLEANUP-CONVERSATIONS-01 — Remove any e2e-created conversations

**Goal**: Conversations whose title matches the e2e prompts get deleted. Existing user conversations are untouched.

**Steps**:
```bash
# Match titles we used in 20-chat-basic.md, 21-chat-streaming.md, 22-chat-pickers.md
PATTERNS='respond with one word: blue|count from 1 to|haiku about coffee|list files in /tmp/herbie-mcp-test|say hi in one word|use the filesystem MCP tool list_directory|Use filesystem/list_directory'
curl -s http://127.0.0.1:4575/chat | jq -r --arg p "$PATTERNS" '.[] | select(.title | test($p; "i")) | .id' | \
  while read CONV; do
    echo "deleting $CONV"
    curl -s -X DELETE "http://127.0.0.1:4575/chat/$CONV" > /dev/null
  done
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/chat | jq --arg p "$PATTERNS" 'map(select(.title | test($p; "i"))) | length'
# expect: 0
```

---

## CLEANUP-TASKS-01 — Remove e2e-created tasks

**Steps**:
```bash
curl -s http://127.0.0.1:4575/tasks | jq -r '.[] | select(.title | test("e2e|smoke|bad cron"; "i")) | .id' | \
  while read TASK; do
    echo "deleting $TASK"
    curl -s -X DELETE "http://127.0.0.1:4575/tasks/$TASK" > /dev/null
  done
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/tasks | jq 'map(select(.title | test("e2e|smoke|bad cron"; "i"))) | length'
# expect: 0
```

---

## CLEANUP-SETTINGS-01 — Restore settings to baseline

**Goal**: Restore the snapshot captured in ENV-SETTINGS-01.

**Steps**:
```bash
if [ -f /tmp/herbie-e2e-settings-baseline.json ]; then
  # Reduce baseline to a PATCH body covering the writable fields.
  jq '{
    general: .general,
    agents: .agents,
    appearance: .appearance,
    mcp: .mcp
  }' /tmp/herbie-e2e-settings-baseline.json > /tmp/herbie-e2e-settings-restore.json
  curl -s -X PATCH http://127.0.0.1:4575/settings \
    -H "Content-Type: application/json" \
    --data-binary @/tmp/herbie-e2e-settings-restore.json > /dev/null
  echo "settings restored"
else
  echo "no baseline captured — skipping. Reset to defaults manually if you need a clean slate."
fi
```

**Verification**:
```bash
diff <(jq -S '{general,agents,appearance,mcp}' /tmp/herbie-e2e-settings-baseline.json) \
     <(curl -s http://127.0.0.1:4575/settings | jq -S '{general,agents,appearance,mcp}')
# expect: empty diff
```

**Cleanup**:
```bash
rm -f /tmp/herbie-e2e-settings-baseline.json /tmp/herbie-e2e-settings-restore.json
```

---

## CLEANUP-TMPFILES-01 — Remove e2e tmp files

```bash
rm -f /tmp/herbie-e2e-conv-id /tmp/herbie-e2e-task-id
# Leave /tmp/herbie-mcp-test alone — harmless and reusable next pass.
```

---

## CLEANUP-SCREENSHOTS-01 — Archive screenshots from this pass

**Goal**: Move the pass's screenshots into a dated archive so the next pass starts with a clean directory.

**Steps**:
```bash
PASS_DIR=~/workbench/screenshots/DaniAkash/herbie/e2e
ARCHIVE=~/workbench/screenshots/DaniAkash/herbie/e2e-archive/$(date +%Y-%m-%d-%H%M)
mkdir -p "$ARCHIVE"
# Move per-doc subdirectories
for d in "$PASS_DIR"/*/ ; do
  [ -d "$d" ] && mv "$d" "$ARCHIVE/"
done
# Move loose env screenshots too
mv "$PASS_DIR"/*.png "$ARCHIVE/" 2>/dev/null
echo "archived to $ARCHIVE"
```

**Cleanup**: None — the screenshots are evidence; keep the archives.

---

## CLEANUP-LAUNCHAGENT-01 — Ensure LaunchAgent matches the baseline setting

**Goal**: If SET-LAUNCH-01 created the plist and crashed before cleanup, leave nothing behind.

**Steps**:
```bash
LAUNCH=$(curl -s http://127.0.0.1:4575/settings | jq '.general.launchAtLogin')
PLIST=~/Library/LaunchAgents/herbie.daniakash.com.plist
if [ "$LAUNCH" = "false" ] && [ -f "$PLIST" ]; then
  echo "removing stray plist"
  rm "$PLIST"
fi
```

**Verification**:
```bash
# Either both present (launch=true + plist exists) or both absent.
test "$(curl -s http://127.0.0.1:4575/settings | jq -r '.general.launchAtLogin')" = "true" && \
  test -f ~/Library/LaunchAgents/herbie.daniakash.com.plist && echo "consistent (both present)" || \
test "$(curl -s http://127.0.0.1:4575/settings | jq -r '.general.launchAtLogin')" = "false" && \
  ! test -f ~/Library/LaunchAgents/herbie.daniakash.com.plist && echo "consistent (both absent)"
```

---

## Done

```bash
echo "pass cleanup complete"
```
