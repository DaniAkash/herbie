# Herbie e2e regression suite

This folder is the **regression contract** for Herbie's user-facing features. Every test is written so an agent (or a human) can execute it step-by-step using only `agent-browser`, `curl`, and small `bun -e '...'` snippets — no special test runner required.

If you ship a feature that touches a flow described here, **update the doc in the same PR**.

---

## Run order

```
00-environment.md         Setup once per test pass.
10-settings-general.md    Theme, launch-at-login, menubar-close.
11-settings-agents.md     Agent detection, default-agent picker.
12-settings-registry.md   MCP server registry.
13-settings-app-menu.md   Cmd+C/V/X/A in WebView text fields.
20-chat-basic.md          Send → reply → persist → reload.
21-chat-streaming.md      Live streaming, tool calls, mid-stream reconnect.
22-chat-pickers.md        Agent / workspace / model / reasoning pickers.
30-tasks.md               Create / schedule / Test button / inbox delivery.
40-inbox.md               Read items, Open-in-chat handoff.
90-cleanup.md             Reset to known-good state.
```

Files are numbered for recommended order — settings before chat (so the default agent + MCP servers are configured before chat tests use them), chat before tasks (tasks run conversations under the hood), inbox last (tasks feed inbox).

---

## Conventions

### Test ID

Every test has a stable id of the form `<AREA>-<SUBAREA>-<NN>` (e.g. `MCP-ADD-01`, `CHAT-STREAM-03`). Reference these in PRs ("fixes the regression in `CHAT-STREAM-03`") and bug reports.

### Sections per test

Every test uses this exact structure so the agent can parse it:

```markdown
## TEST-ID — Short description

**Goal**: one-sentence statement of what's being verified.

**Preconditions**: state the app/data must be in before this test runs.

**Steps**: copy-pasteable commands.

**Expected**: what the user should see / the API should return.

**Verification**: programmatic assertion (curl + jq, `agent-browser eval`, DB query).

**Cleanup**: revert any state changes made by this test.
```

### Session names

`agent-browser` sessions follow `e2e-<area>` so each file's session is isolated (e.g. `e2e-settings`, `e2e-chat`). One session per file keeps refs stable within a file but isolates cross-file state.

### Viewport

Default `1280 900`. Set at the top of each file's setup block.

### Screenshots

Save under `~/workbench/screenshots/DaniAkash/herbie/e2e/<doc-stem>/<test-id>.png`. Screenshots are evidence + a debugging aid — they are **not** the authoritative assertion. The `Verification` block is. (A screenshot can look right while the underlying state is wrong.)

### Cleanup contract

Every test must leave the system in the state it found. The `90-cleanup.md` at the end is a belt-and-braces wipe for state that escaped a per-test cleanup.

### Manual-only steps

Some checks (e.g. "quit the app via menubar → relaunch") can't be driven by `agent-browser`. Prefix those tests with `[MANUAL]` in the title so automation skips them but surfaces them to the human runner:

```markdown
## [MANUAL] APP-RESTART-01 — Window state persists across quit/relaunch
```

---

## Prerequisites for any pass

1. macOS (Herbie is macOS-only today).
2. `bun` + `agent-browser` + `gh` + `jq` on PATH.
3. Herbie running from the branch under test:
   ```sh
   cd ~/workbench/worktrees/DaniAkash/herbie/<branch>
   bun install
   bun x vite --port 5173 &           # renderer dev server
   bun start                          # builds + launches the macOS app + API at :4575
   ```
4. At least Claude Code installed + authenticated for any chat-touching test (see `00-environment.md` for how to verify).
5. The test data directory exists:
   ```sh
   mkdir -p /tmp/herbie-mcp-test
   echo "hello from herbie test" > /tmp/herbie-mcp-test/hello.txt
   echo "second file" > /tmp/herbie-mcp-test/notes.md
   ```

---

## How to drive a full pass

```bash
# In a clean terminal session, open each doc in order, execute the bash blocks,
# capture screenshots, and verify each step. The 90-cleanup.md at the end
# resets state.

# For agents: read the markdown, execute the code blocks inside `Steps:` and
# `Verification:`, parse the Expected text to decide pass/fail.
```

Pass criteria for a release-ready build: every non-`[MANUAL]` test passes; manual ones are flagged for the human reviewer.

---

## Updating this suite

- New feature → add at least one happy-path test in the appropriate file.
- Bug fix → add a regression test under the failing flow's file.
- Renaming/removing a feature → update the corresponding doc; don't leave stale tests.
- File getting too long (~30 tests) → split by sub-area, keeping the numeric prefix discoverable (e.g. `21-chat-streaming-text.md` + `21-chat-streaming-tools.md`).
