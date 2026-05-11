# 13 — Application menu (Cmd+C/V/X/A)

macOS routes Cmd+C/V/X/A through the application menu's responder chain into the focused WebView. Without an application menu (set in `src/bun/applicationMenu.ts`), these shortcuts silently no-op in every text field.

These tests verify the menu is installed AND the standard shortcuts work end-to-end in the renderer.

## Setup

```bash
agent-browser --session e2e-menu set viewport 1280 900
agent-browser --session e2e-menu open http://localhost:5173/chat/new
agent-browser --session e2e-menu wait --load networkidle
```

---

## [MANUAL] APP-MENU-01 — Menu bar shows Herbie / Edit / Window menus

**Goal**: Confirm the macOS menu bar reflects the application menu we set at boot.

**Steps**: Click the menu bar with Herbie focused. Visually verify "Herbie", "Edit", "Window" menus are present.

**Expected**:
- **Herbie**: About, Hide ⌘H, Hide Others ⌥⌘H, Show All, Quit ⌘Q
- **Edit**: Undo ⌘Z, Redo ⌘⇧Z, Cut ⌘X, Copy ⌘C, Paste ⌘V, Paste and Match Style, Delete, Select All ⌘A
- **Window**: Minimize ⌘M, Zoom, Close ⌘W, Toggle Full Screen (no Herbie-set accelerator — OS default ⌃⌘F)

**Cleanup**: None.

---

## APP-MENU-02 — Cmd+C copies selected text in composer

**Goal**: Type text into the chat composer, select all, copy, and verify the OS clipboard.

**Steps**:
```bash
agent-browser --session e2e-menu snapshot -i | grep -iE "ask anything"
agent-browser --session e2e-menu fill @<composer-ref> "hello clipboard"
sleep 0.3
agent-browser --session e2e-menu eval "
  const el = document.querySelector('textarea[placeholder=\"Ask anything…\"]') ||
             document.querySelector('textarea')
  el.focus()
  el.select()
"
agent-browser --session e2e-menu keyboard --modifiers cmd 'c'   # or: press the shortcut
sleep 0.3
agent-browser --session e2e-menu clipboard read
```

**Expected**: Clipboard returns `hello clipboard`.

**Cleanup**:
```bash
agent-browser --session e2e-menu fill @<composer-ref> ""
agent-browser --session e2e-menu clipboard write ""
```

---

## APP-MENU-03 — Cmd+V pastes into composer

**Steps**:
```bash
agent-browser --session e2e-menu clipboard write "pasted from clipboard"
agent-browser --session e2e-menu click @<composer-ref>
agent-browser --session e2e-menu keyboard --modifiers cmd 'v'
sleep 0.3
agent-browser --session e2e-menu eval "document.querySelector('textarea').value"
```

**Expected**: Returns `"pasted from clipboard"`.

**Cleanup**:
```bash
agent-browser --session e2e-menu fill @<composer-ref> ""
agent-browser --session e2e-menu clipboard write ""
```

---

## APP-MENU-04 — Cmd+A selects all in composer

**Steps**:
```bash
agent-browser --session e2e-menu fill @<composer-ref> "alpha beta gamma"
agent-browser --session e2e-menu click @<composer-ref>
agent-browser --session e2e-menu keyboard --modifiers cmd 'a'
sleep 0.3
agent-browser --session e2e-menu eval "
  const el = document.activeElement
  el.selectionEnd - el.selectionStart
"
```

**Expected**: Returns `16` (length of "alpha beta gamma").

**Cleanup**:
```bash
agent-browser --session e2e-menu fill @<composer-ref> ""
```

---

## APP-MENU-05 — Cmd+X cuts selected text

**Steps**:
```bash
agent-browser --session e2e-menu fill @<composer-ref> "cut me"
agent-browser --session e2e-menu eval "
  const el = document.querySelector('textarea')
  el.focus(); el.select()
"
agent-browser --session e2e-menu keyboard --modifiers cmd 'x'
sleep 0.3
echo "clipboard:"; agent-browser --session e2e-menu clipboard read
echo "composer:"; agent-browser --session e2e-menu eval "document.querySelector('textarea').value"
```

**Expected**: clipboard = `"cut me"`, composer = `""`.

**Cleanup**:
```bash
agent-browser --session e2e-menu clipboard write ""
```

---

## APP-MENU-06 — Cmd+Z undoes a deletion

**Goal**: Quick sanity that Edit → Undo is wired (covers the role-to-NSResponder selector mapping).

**Steps**:
```bash
agent-browser --session e2e-menu fill @<composer-ref> "before undo"
agent-browser --session e2e-menu eval "
  const el = document.querySelector('textarea')
  el.focus(); el.select()
"
agent-browser --session e2e-menu press Backspace
sleep 0.3
agent-browser --session e2e-menu keyboard --modifiers cmd 'z'
sleep 0.3
agent-browser --session e2e-menu eval "document.querySelector('textarea').value"
```

**Expected**: Returns `"before undo"` (the text was restored).

**Cleanup**:
```bash
agent-browser --session e2e-menu fill @<composer-ref> ""
```

---

## [MANUAL] APP-MENU-07 — Cmd+W respects "Keep in menu bar on close"

**Goal**: `role: 'close'` in the Window menu fires the window's close event, which Herbie's handler routes through `minimizeToMenubarOnClose`.

**Steps**:
1. Set the toggle to ON (Settings → General).
2. Press Cmd+W with Herbie focused.
3. Window hides; tray icon remains; port 4575 still up.
4. Click tray icon → window returns.
5. Set toggle to OFF; press Cmd+W; app quits, port frees.

**Verification**: Manual. Use `lsof -nP -iTCP:4575` to check the API state between steps.

**Cleanup**: Reset toggle to ON; relaunch via `bun start` if quit.

---

## Teardown

```bash
agent-browser --session e2e-menu close
```
