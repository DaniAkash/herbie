# 30 — Scheduled tasks

Create / edit / delete tasks. Schedule via cron. Test button for ad-hoc runs. Boot-catchup. Inbox delivery on completion.

## Setup

```bash
agent-browser --session e2e-tasks set viewport 1280 900
agent-browser --session e2e-tasks open http://localhost:5173/tasks
agent-browser --session e2e-tasks wait --load networkidle
```

---

## TASKS-LIST-01 — Tasks index renders

**Steps**:
```bash
agent-browser --session e2e-tasks screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/30-tasks/list.png --full
```

**Expected**: Header "Tasks", "+ New task" button, list (possibly empty), no broken layout.

**Verification**:
```bash
curl -s http://127.0.0.1:4575/tasks | jq 'type'
# expect: "array"
```

**Cleanup**: None.

---

## TASKS-CREATE-01 — Create a new task via the editor

**Steps**:
```bash
agent-browser --session e2e-tasks snapshot -i | grep -iE "new task"
agent-browser --session e2e-tasks click @<new-task-ref>
sleep 1
agent-browser --session e2e-tasks screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/30-tasks/editor.png --full

# Fill the editor — locate inputs via snapshot
agent-browser --session e2e-tasks snapshot -i | head -30
agent-browser --session e2e-tasks fill @<title-input> "e2e smoke task"
agent-browser --session e2e-tasks fill @<prompt-input> "Say done in one word."

# Pick the smallest interval (or set cron explicitly). Form should accept a
# valid cron like "*/5 * * * *". Locate the cron field:
agent-browser --session e2e-tasks fill @<cron-input> "0 9 * * *"

agent-browser --session e2e-tasks snapshot -i | grep -iE "save"
agent-browser --session e2e-tasks click @<save-button>
sleep 1
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/tasks | jq '.[0] | {title, cron, prompt}'
# expect: {"title":"e2e smoke task","cron":"0 9 * * *","prompt":"Say done in one word."}
```

**Cleanup**: Save the task id for follow-up tests:
```bash
curl -s http://127.0.0.1:4575/tasks | jq -r '.[0].id' > /tmp/herbie-e2e-task-id
```

---

## TASKS-VALIDATE-01 — Invalid cron rejected client-side

**Steps**:
```bash
agent-browser --session e2e-tasks open http://localhost:5173/tasks/new
agent-browser --session e2e-tasks wait --load networkidle
agent-browser --session e2e-tasks fill @<title-input> "bad cron"
agent-browser --session e2e-tasks fill @<prompt-input> "x"
agent-browser --session e2e-tasks fill @<cron-input> "not-a-cron"
agent-browser --session e2e-tasks click @<save-button>
sleep 0.5
agent-browser --session e2e-tasks screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/30-tasks/bad-cron.png --full
```

**Expected**: Inline validation error on the cron field. Save did NOT navigate away (still on the editor).

**Verification**:
```bash
curl -s http://127.0.0.1:4575/tasks | jq 'map(select(.title == "bad cron")) | length'
# expect: 0
```

**Cleanup**: Cancel out of the editor.

---

## TASKS-TEST-01 — Test button runs the task ad-hoc

**Goal**: Clicking "Test" runs the task immediately without waiting for the cron — single-turn run, result lands in the right sidebar's run history.

**Preconditions**: Task from TASKS-CREATE-01 exists.

**Steps**:
```bash
TASK_ID=$(cat /tmp/herbie-e2e-task-id)
agent-browser --session e2e-tasks open "http://localhost:5173/tasks/$TASK_ID"
agent-browser --session e2e-tasks wait --load networkidle
agent-browser --session e2e-tasks snapshot -i | grep -iE "test"
agent-browser --session e2e-tasks click @<test-button-ref>
sleep 25
agent-browser --session e2e-tasks screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/30-tasks/test-run.png --full
```

**Expected**: A run appears in the right sidebar with status "Succeeded" (or "Failed" if the agent errored — at minimum, status moves off "running").

**Verification**:
```bash
TASK_ID=$(cat /tmp/herbie-e2e-task-id)
curl -s "http://127.0.0.1:4575/tasks/$TASK_ID/runs" | jq '.[0] | {status, finishedAt}'
# expect: status is "succeeded" or "failed" — NOT "running"
```

**Cleanup**: None.

---

## TASKS-INBOX-01 — Run completion delivers an inbox card

**Preconditions**: TASKS-TEST-01 produced a "succeeded" run.

**Verification**:
```bash
TASK_ID=$(cat /tmp/herbie-e2e-task-id)
# Inbox items reference the task that produced them:
curl -s http://127.0.0.1:4575/inbox | jq --arg tid "$TASK_ID" 'map(select(.taskId == $tid)) | length'
# expect: >= 1
```

**Cleanup**: None.

---

## TASKS-DELETE-01 — Delete task removes it + future runs

**Steps**:
```bash
TASK_ID=$(cat /tmp/herbie-e2e-task-id)
agent-browser --session e2e-tasks open "http://localhost:5173/tasks/$TASK_ID"
agent-browser --session e2e-tasks wait --load networkidle
agent-browser --session e2e-tasks snapshot -i | grep -iE "delete"
agent-browser --session e2e-tasks click @<delete-button>
sleep 0.5
agent-browser --session e2e-tasks snapshot -i | grep -iE "confirm|delete"
agent-browser --session e2e-tasks click @<confirm-delete>
sleep 1
```

**Verification**:
```bash
TASK_ID=$(cat /tmp/herbie-e2e-task-id)
curl -s "http://127.0.0.1:4575/tasks/$TASK_ID" -o /dev/null -w "%{http_code}"
# expect: 404

# Inbox cards from this task linger by design (they're a delivered artifact)
# but no NEW runs should be scheduled.
```

**Cleanup**:
```bash
rm -f /tmp/herbie-e2e-task-id
```

---

## [MANUAL] TASKS-SCHEDULE-01 — Cron actually fires

**Goal**: A task with a `*/2 * * * *` (every two minutes) cron actually runs at the expected time.

**Steps**:
1. Create a task with cron `*/2 * * * *` and prompt "say done".
2. Wait up to 2.5 minutes (one cron tick).
3. Check `GET /tasks/<id>/runs` — at least one run should have appeared.

**Cleanup**: Delete the task after the manual check.

---

## [MANUAL] TASKS-BOOT-RECOVERY-01 — Runs left "running" mid-process recover at boot

**Goal**: If Herbie is killed during a task run, the next launch flips that run from `running` → `failed` so the UI doesn't show it stuck forever.

**Steps**:
1. Start a long-running task (prompt: "count from 1 to 1000 slowly").
2. Force-quit Herbie via Activity Monitor (NOT via the menubar — we need to leave the run dangling).
3. Relaunch via `bun start`.
4. Check the run: its status should be `failed` with an error like "interrupted at boot".

**Cleanup**: Delete the test task.

---

## Teardown

```bash
agent-browser --session e2e-tasks close
```
