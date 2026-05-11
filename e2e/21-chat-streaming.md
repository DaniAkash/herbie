# 21 — Chat / Streaming + tool calls

Rich rendering: streaming text, reasoning blocks, tool calls (including MCP), mid-stream reconnect. Most of these need an MCP server configured — `12-settings-registry.md::MCP-UI-ADD-01` adds the filesystem one we use here.

## Setup

```bash
agent-browser --session e2e-stream set viewport 1280 900

# Ensure the filesystem MCP server is registered (idempotent)
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[{"id":"e2e-fs","type":"stdio","name":"filesystem","command":"npx","args":["-y","@modelcontextprotocol/server-filesystem","/tmp/herbie-mcp-test"],"env":[]}]}}' > /dev/null

# Confirm test directory is seeded (from ENV-MCP-DATA-01)
ls /tmp/herbie-mcp-test/
```

---

## CHAT-STREAM-01 — Text streams token-by-token

**Goal**: During an in-flight turn, the assistant message updates incrementally — multiple screenshots taken seconds apart show growing text.

**Steps**:
```bash
agent-browser --session e2e-stream open http://localhost:5173/chat/new
agent-browser --session e2e-stream wait --load networkidle
agent-browser --session e2e-stream snapshot -i | grep -iE "ask anything"
agent-browser --session e2e-stream fill @<composer-ref> "write a six-line haiku about coffee"
agent-browser --session e2e-stream press Enter

# Capture frames during streaming
sleep 2
agent-browser --session e2e-stream screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/21-chat-streaming/stream-t2s.png --full
sleep 3
agent-browser --session e2e-stream screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/21-chat-streaming/stream-t5s.png --full
sleep 5
agent-browser --session e2e-stream screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/21-chat-streaming/stream-done.png --full
```

**Expected**: Successive screenshots show the assistant's haiku growing line by line. Final screenshot has a complete haiku.

**Verification**:
```bash
CONV_ID=$(curl -s http://127.0.0.1:4575/chat | jq -r '.[0].id')
curl -s "http://127.0.0.1:4575/chat/$CONV_ID" | jq '.conversation.status'
# expect: "idle" (turn finished)
```

**Cleanup**: Done in teardown.

---

## CHAT-STREAM-02 — MCP tool call renders as a rich block

**Goal**: Asking the agent to use the `filesystem/list_directory` MCP tool produces a Tool block with parameters, status badge, and result.

**Steps**:
```bash
agent-browser --session e2e-stream open http://localhost:5173/chat/new
agent-browser --session e2e-stream wait --load networkidle
agent-browser --session e2e-stream snapshot -i | grep -iE "ask anything"
agent-browser --session e2e-stream fill @<composer-ref> "Use the filesystem MCP tool list_directory to list /tmp/herbie-mcp-test. Then in one sentence tell me how many files you saw."
agent-browser --session e2e-stream press Enter
sleep 30
agent-browser --session e2e-stream screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/21-chat-streaming/mcp-tool-call.png --full
```

**Expected**: A Tool block with name `filesystem/list_directory`, "Completed" status badge, parameters showing the directory path, result listing `hello.txt` and `notes.md`, and a final assistant text saying "2 files" (or similar).

**Verification**:
```bash
CONV_ID=$(curl -s http://127.0.0.1:4575/chat | jq -r '.[0].id')
bun -e "
  const { createClient } = await import('@libsql/client')
  const c = createClient({ url: 'file:' + require('node:os').homedir() + '/.herbie/data.db' })
  const r = await c.execute({ sql: \"SELECT type FROM chat_events WHERE conversation_id = ? ORDER BY seq\", args: ['$CONV_ID'] })
  const types = r.rows.map(x => x.type).join(',')
  console.log(types)
"
# expect: types include tool.call, tool.result (one or more), assistant.text, turn.finish
```

**Cleanup**: Done in teardown.

---

## CHAT-STREAM-03 — Replay reconstructs rich UI from coalesced events

**Goal**: Reloading a finished conversation renders the same rich UI (tool blocks, reasoning, text) from the coalesced terminal events alone — no need to replay individual deltas.

**Preconditions**: Run CHAT-STREAM-02 first to create a conversation with a tool call.

**Steps**:
```bash
CONV_ID=$(curl -s http://127.0.0.1:4575/chat | jq -r '.[0].id')
agent-browser --session e2e-stream open "http://localhost:5173/chat/$CONV_ID"
agent-browser --session e2e-stream wait --load networkidle
sleep 1
agent-browser --session e2e-stream screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/21-chat-streaming/replay.png --full
```

**Expected**: The Tool block + assistant text render identically to the post-stream screenshot from CHAT-STREAM-02. No "thinking..." placeholder.

**Verification**: Compare `mcp-tool-call.png` vs `replay.png` — same content, same Tool block state.

**Cleanup**: None.

---

## CHAT-STREAM-04 — Mid-turn reconnect picks up the in-flight buffer

**Goal**: Closing + reopening the renderer mid-stream picks up the in-flight text from the `ChatSession.buffer` (in-memory active-turn buffer) so the user doesn't see a frozen "thinking..." until the turn ends.

**Steps**:
```bash
agent-browser --session e2e-stream-a set viewport 1280 900
agent-browser --session e2e-stream-a open http://localhost:5173/chat/new
agent-browser --session e2e-stream-a wait --load networkidle
agent-browser --session e2e-stream-a snapshot -i | grep -iE "ask anything"
agent-browser --session e2e-stream-a fill @<composer-ref> "count from 1 to 30, one number per line, slowly"
agent-browser --session e2e-stream-a press Enter
sleep 4

# Open a second session pointing at the same conversation. The new subscriber
# should see in-flight text via the active-turn snapshot bridge.
CONV_ID=$(curl -s http://127.0.0.1:4575/chat | jq -r '.[0].id')
agent-browser --session e2e-stream-b set viewport 1280 900
agent-browser --session e2e-stream-b open "http://localhost:5173/chat/$CONV_ID"
agent-browser --session e2e-stream-b wait --load networkidle
sleep 2
agent-browser --session e2e-stream-b screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/21-chat-streaming/mid-stream-reconnect.png --full
```

**Expected**: Screenshot from `e2e-stream-b` shows the assistant message already populated with the count so far (not empty / not "thinking...").

**Cleanup**:
```bash
sleep 20   # let the turn finish
agent-browser --session e2e-stream-a close
agent-browser --session e2e-stream-b close
curl -s -X DELETE "http://127.0.0.1:4575/chat/$CONV_ID" > /dev/null
```

---

## CHAT-STREAM-05 — MCP server change applies only to new conversations

**Goal**: Removing an MCP server mid-conversation doesn't strip tools from the running session; the next new conversation reflects the change.

**Preconditions**: filesystem MCP server registered (from Setup).

**Steps**:
```bash
# Step 1: start a conversation that uses the MCP tool
agent-browser --session e2e-stream open http://localhost:5173/chat/new
agent-browser --session e2e-stream wait --load networkidle
agent-browser --session e2e-stream snapshot -i | grep -iE "ask anything"
agent-browser --session e2e-stream fill @<composer-ref> "list files in /tmp/herbie-mcp-test using filesystem/list_directory"
agent-browser --session e2e-stream press Enter
sleep 25
CONV_A=$(curl -s http://127.0.0.1:4575/chat | jq -r '.[0].id')

# Step 2: remove the MCP server
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[]}}' > /dev/null

# Step 3: same conversation — second turn — should still have the tool
agent-browser --session e2e-stream snapshot -i | grep -iE "type a message"
agent-browser --session e2e-stream fill @<composer-ref> "list /tmp/herbie-mcp-test again using the same tool"
agent-browser --session e2e-stream press Enter
sleep 25
agent-browser --session e2e-stream screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/21-chat-streaming/stream-05-after-remove.png --full

# Step 4: new conversation — should NOT have the tool
agent-browser --session e2e-stream open http://localhost:5173/chat/new
agent-browser --session e2e-stream wait --load networkidle
agent-browser --session e2e-stream snapshot -i | grep -iE "ask anything"
agent-browser --session e2e-stream fill @<composer-ref> "Use filesystem/list_directory to list /tmp/herbie-mcp-test. If unavailable, say so in one sentence."
agent-browser --session e2e-stream press Enter
sleep 25
agent-browser --session e2e-stream screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/21-chat-streaming/stream-05-new-chat.png --full
```

**Expected**:
- `stream-05-after-remove.png`: tool block fires + succeeds (running session keeps its tools).
- `stream-05-new-chat.png`: agent reports the tool isn't available, or falls back to a shell tool — but no `filesystem/list_directory` block appears.

**Verification**: Inspect both screenshots.

**Cleanup**:
```bash
CONV_B=$(curl -s http://127.0.0.1:4575/chat | jq -r '.[0].id')
curl -s -X DELETE "http://127.0.0.1:4575/chat/$CONV_A" > /dev/null
curl -s -X DELETE "http://127.0.0.1:4575/chat/$CONV_B" > /dev/null
```

---

## Teardown

```bash
# Restore the filesystem MCP server for subsequent doc files if you continue.
# Otherwise leave registry empty.
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"mcp":{"servers":[]}}' > /dev/null
agent-browser --session e2e-stream close
agent-browser --session e2e-stream-a close 2>/dev/null
agent-browser --session e2e-stream-b close 2>/dev/null
```
