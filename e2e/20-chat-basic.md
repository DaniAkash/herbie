# 20 — Chat / Basic flow

Send a message, get a reply, see it persist. No tools, no MCP — the simplest possible round-trip.

## Setup

```bash
agent-browser --session e2e-chat set viewport 1280 900
agent-browser --session e2e-chat open http://localhost:5173/
agent-browser --session e2e-chat wait --load networkidle
```

---

## CHAT-NEW-01 — Home page renders the composer

**Steps**:
```bash
agent-browser --session e2e-chat screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/20-chat-basic/home.png --full
agent-browser --session e2e-chat snapshot -i | grep -iE "ask anything"
```

**Expected**: Home page shows "What's on your mind?" headline + composer with placeholder "Ask anything…".

**Cleanup**: None.

---

## CHAT-SEND-01 — Send a short message, observe streaming + reply

**Goal**: A new conversation is created, the user message renders, the assistant streams a reply.

**Steps**:
```bash
agent-browser --session e2e-chat snapshot -i | grep -iE "ask anything"
agent-browser --session e2e-chat fill @<composer-ref> "respond with one word: blue"
agent-browser --session e2e-chat press Enter
sleep 2
agent-browser --session e2e-chat screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/20-chat-basic/sending.png --full
sleep 12
agent-browser --session e2e-chat screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/20-chat-basic/replied.png --full
```

**Expected**:
- During the wait, "thinking..." placeholder shows.
- After completion, the assistant message appears with "blue" (case may vary).
- The new conversation appears at the top of the sidebar with the message's first 60 chars as the title.

**Verification**:
```bash
curl -s http://127.0.0.1:4575/chat | jq '.[0].title'
# expect: "respond with one word: blue"

# Extract the conversation id for next tests:
CONV_ID=$(curl -s http://127.0.0.1:4575/chat | jq -r '.[0].id')
echo "$CONV_ID" > /tmp/herbie-e2e-conv-id
```

**Cleanup**: Conversation kept for CHAT-PERSIST-01 + CHAT-RELOAD-01.

---

## CHAT-PERSIST-01 — Events stored compactly

**Goal**: Single-turn text conversation lands as ~3 chat_events rows (turn.start + assistant.text + turn.finish), not the pre-coalescing ~25.

**Verification**:
```bash
CONV_ID=$(cat /tmp/herbie-e2e-conv-id)
bun -e "
  const { createClient } = await import('@libsql/client')
  const c = createClient({ url: 'file:' + require('node:os').homedir() + '/.herbie/data.db' })
  const r = await c.execute({ sql: 'SELECT type FROM chat_events WHERE conversation_id = ? ORDER BY seq', args: ['$CONV_ID'] })
  console.log('types:', r.rows.map(x => x.type).join(','))
"
# expect: types: turn.start,assistant.text,turn.finish
```

**Cleanup**: None.

---

## CHAT-RELOAD-01 — Hard reload replays the conversation

**Goal**: After a hard reload, the conversation renders identically from the event log alone.

**Steps**:
```bash
CONV_ID=$(cat /tmp/herbie-e2e-conv-id)
agent-browser --session e2e-chat open "http://localhost:5173/chat/$CONV_ID"
agent-browser --session e2e-chat wait --load networkidle
sleep 1
agent-browser --session e2e-chat screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/20-chat-basic/reloaded.png --full
```

**Expected**: Screenshot shows the user message + assistant reply intact — same content as CHAT-SEND-01's `replied.png`.

**Verification**: Compare the two screenshots manually.

**Cleanup**: None.

---

## CHAT-DELETE-01 — Delete conversation removes it from the sidebar

**Steps**:
```bash
CONV_ID=$(cat /tmp/herbie-e2e-conv-id)
curl -s -X DELETE "http://127.0.0.1:4575/chat/$CONV_ID" > /dev/null
sleep 0.5
```

**Verification**:
```bash
curl -s "http://127.0.0.1:4575/chat/$CONV_ID" -o /dev/null -w "%{http_code}"
# expect: 404

# Confirm no chat_events left for that conversation:
bun -e "
  const { createClient } = await import('@libsql/client')
  const c = createClient({ url: 'file:' + require('node:os').homedir() + '/.herbie/data.db' })
  const r = await c.execute({ sql: 'SELECT COUNT(*) as n FROM chat_events WHERE conversation_id = ?', args: ['$CONV_ID'] })
  console.log('events left:', r.rows[0].n)
"
# expect: events left: 0  (ON DELETE CASCADE on the conversations FK)
```

**Cleanup**: Done.

---

## CHAT-CANCEL-01 — Mid-stream cancel ends the turn cleanly

**Goal**: Hitting cancel during streaming writes `turn.cancel` and the conversation status flips to `cancelled`.

**Steps**:
```bash
agent-browser --session e2e-chat open http://localhost:5173/chat/new
agent-browser --session e2e-chat wait --load networkidle
agent-browser --session e2e-chat snapshot -i | grep -iE "ask anything"
agent-browser --session e2e-chat fill @<composer-ref> "count from 1 to 100, one number per line"
agent-browser --session e2e-chat press Enter
sleep 3   # let it start streaming

# Find the cancel button (visible while streaming)
agent-browser --session e2e-chat snapshot -i | grep -iE "stop|cancel"
agent-browser --session e2e-chat click @<cancel-button-ref>
sleep 2
```

**Verification**:
```bash
CONV_ID=$(curl -s http://127.0.0.1:4575/chat | jq -r '.[0].id')
curl -s "http://127.0.0.1:4575/chat/$CONV_ID" | jq '.conversation.status'
# expect: "cancelled"

bun -e "
  const { createClient } = await import('@libsql/client')
  const c = createClient({ url: 'file:' + require('node:os').homedir() + '/.herbie/data.db' })
  const r = await c.execute({ sql: \"SELECT type FROM chat_events WHERE conversation_id = ? AND type = 'turn.cancel'\", args: ['$CONV_ID'] })
  console.log('cancel events:', r.rows.length)
"
# expect: cancel events: 1
```

**Cleanup**:
```bash
curl -s -X DELETE "http://127.0.0.1:4575/chat/$CONV_ID" > /dev/null
```

---

## Teardown

```bash
agent-browser --session e2e-chat close
rm -f /tmp/herbie-e2e-conv-id
```
