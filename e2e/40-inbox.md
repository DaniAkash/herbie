# 40 — Inbox

Cards delivered by scheduled task runs. Read, dismiss, Open-in-chat handoff seeds a new conversation with the task's output as context.

## Setup

```bash
agent-browser --session e2e-inbox set viewport 1280 900
agent-browser --session e2e-inbox open http://localhost:5173/inbox
agent-browser --session e2e-inbox wait --load networkidle
```

---

## INBOX-LIST-01 — Inbox index renders

**Steps**:
```bash
agent-browser --session e2e-inbox screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/40-inbox/list.png --full
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/inbox | jq 'type'
# expect: "array"
```

**Cleanup**: None.

---

## INBOX-CARD-01 — Inbox card renders task title + body

**Preconditions**: At least one inbox item exists (TASKS-INBOX-01 produced one). If not, create a quick task + Test it via 30-tasks.md first.

**Steps**:
```bash
agent-browser --session e2e-inbox snapshot -i | head -30
# Locate the first inbox card by its task title
agent-browser --session e2e-inbox click @<first-card-ref>
sleep 1
agent-browser --session e2e-inbox screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/40-inbox/card-open.png --full
```

**Expected**: The card detail view shows the task title, the agent's output, and an "Open in chat" CTA.

**Verification**:
```bash
ITEM=$(curl -s http://127.0.0.1:4575/inbox | jq -r '.[0].id')
curl -s "http://127.0.0.1:4575/inbox/$ITEM" | jq '{id, taskId, body}'
# expect: all three fields present
```

**Cleanup**: None.

---

## INBOX-OPEN-IN-CHAT-01 — Open-in-chat seeds a new conversation

**Goal**: Clicking "Open in chat" on an inbox card creates a new conversation seeded with the task's prompt + output, so the user can continue the thread interactively.

**Steps**:
```bash
agent-browser --session e2e-inbox snapshot -i | grep -iE "open in chat"
agent-browser --session e2e-inbox click @<open-in-chat-ref>
sleep 2
agent-browser --session e2e-inbox screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/40-inbox/handoff.png --full
```

**Expected**: A new conversation opens. The first message(s) reflect the task's prompt + output (typically a user message containing the prompt and an assistant message containing the output, so the agent has context).

**Verification**:
```bash
# The newly-created conversation should be at the top of GET /chat:
CONV=$(curl -s http://127.0.0.1:4575/chat | jq -r '.[0].id')
curl -s "http://127.0.0.1:4575/chat/$CONV" | jq '.events | length'
# expect: > 0 (seeded events present)
```

**Cleanup**:
```bash
CONV=$(curl -s http://127.0.0.1:4575/chat | jq -r '.[0].id')
curl -s -X DELETE "http://127.0.0.1:4575/chat/$CONV" > /dev/null
```

---

## INBOX-DISMISS-01 — Dismiss removes a card

**Steps**:
```bash
agent-browser --session e2e-inbox open http://localhost:5173/inbox
agent-browser --session e2e-inbox wait --load networkidle
agent-browser --session e2e-inbox snapshot -i | grep -iE "dismiss|delete"
agent-browser --session e2e-inbox click @<dismiss-ref>
sleep 0.5
```

**Verification**:
```bash
# Card count decreased by 1
curl -s http://127.0.0.1:4575/inbox | jq 'length'
```

**Cleanup**: None.

---

## Teardown

```bash
agent-browser --session e2e-inbox close
```
