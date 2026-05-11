# 10 — Settings / General

Theme toggle, launch-at-login, keep-in-menubar-on-close.

## Setup

```bash
agent-browser --session e2e-settings set viewport 1280 900
agent-browser --session e2e-settings open http://localhost:5173/settings
agent-browser --session e2e-settings wait --load networkidle
```

---

## SET-THEME-01 — Default theme is "system"

**Goal**: A fresh install (or wiped settings) defaults to `system`.

**Preconditions**: ENV-SETTINGS-01 captured baseline.

**Steps**:
```bash
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"appearance":{"theme":"system"}}' > /dev/null
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/settings | jq '.appearance.theme'
# expect: "system"
```

**Cleanup**: Leave at `system` — that's the default.

---

## SET-THEME-02 — Light mode applies + persists

**Goal**: Selecting "Light" sets the `<html>` class and writes to the API.

**Steps**:
```bash
# Click General tab if not already there
agent-browser --session e2e-settings snapshot -i | grep -iE "tab|general"   # locate General tab ref
# Then click the General tab ref, then locate the "Light" toggle:
agent-browser --session e2e-settings snapshot -i | grep -iE "light|dark|system"
agent-browser --session e2e-settings click @<light-ref>
sleep 0.5
agent-browser --session e2e-settings screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/10-settings-general/set-theme-02.png --full
```

**Expected**: Background is light, text is dark.

**Verification**:
```bash
agent-browser --session e2e-settings eval "document.documentElement.classList.contains('dark')"
# expect: false
curl -s http://127.0.0.1:4575/settings | jq '.appearance.theme'
# expect: "light"
```

**Cleanup**: Done in SET-THEME-04 which restores `system`.

---

## SET-THEME-03 — Dark mode applies + persists

**Goal**: Selecting "Dark" toggles the `dark` class on `<html>` and writes to the API.

**Steps**:
```bash
agent-browser --session e2e-settings click @<dark-ref>
sleep 0.5
agent-browser --session e2e-settings screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/10-settings-general/set-theme-03.png --full
```

**Verification**:
```bash
agent-browser --session e2e-settings eval "document.documentElement.classList.contains('dark')"
# expect: true
curl -s http://127.0.0.1:4575/settings | jq '.appearance.theme'
# expect: "dark"
```

**Cleanup**: Done in SET-THEME-04.

---

## SET-THEME-04 — System mode follows OS, reconciles via matchMedia

**Goal**: Selecting "System" subscribes to `prefers-color-scheme` and applies that.

**Steps**:
```bash
agent-browser --session e2e-settings click @<system-ref>
sleep 0.5
agent-browser --session e2e-settings screenshot ~/workbench/screenshots/DaniAkash/herbie/e2e/10-settings-general/set-theme-04.png --full
```

**Verification**:
```bash
agent-browser --session e2e-settings eval "
  window.matchMedia('(prefers-color-scheme: dark)').matches ===
  document.documentElement.classList.contains('dark')
"
# expect: true (the html class agrees with the OS preference)
curl -s http://127.0.0.1:4575/settings | jq '.appearance.theme'
# expect: "system"
```

**Cleanup**: Already at system default — done.

---

## [MANUAL] SET-THEME-05 — Switching macOS Appearance live-updates the UI

**Goal**: With theme set to `system`, flipping macOS Appearance in System Settings re-applies the theme without restarting Herbie.

**Steps**: Open macOS System Settings → Appearance → flip Light ↔ Dark. Watch Herbie's General tab.

**Expected**: Theme flips synchronously with the OS change.

**Verification**: Manual observation.

**Cleanup**: Restore your normal macOS appearance.

---

## SET-LAUNCH-01 — Launch-at-login writes the LaunchAgent plist

**Goal**: Toggling "Launch at login" creates/removes the LaunchAgent plist.

**Steps**:
```bash
# Locate the toggle (find the switch via accessibility tree)
agent-browser --session e2e-settings snapshot -i | grep -iE "launch.*login"
agent-browser --session e2e-settings click @<launch-at-login-switch-ref>
sleep 1
```

**Verification**:
```bash
ls ~/Library/LaunchAgents/herbie.daniakash.com.plist 2>&1
# expect: file exists
curl -s http://127.0.0.1:4575/settings | jq '.general.launchAtLogin'
# expect: true
```

**Cleanup**:
```bash
agent-browser --session e2e-settings click @<launch-at-login-switch-ref>
sleep 1
ls ~/Library/LaunchAgents/herbie.daniakash.com.plist 2>&1   # expect: No such file
```

---

## SET-MENUBAR-01 — "Keep in menu bar on close" toggle persists

**Goal**: Toggle flips `general.minimizeToMenubarOnClose` in settings.

**Steps**:
```bash
# Set explicitly to false via API to ensure known state
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"general":{"minimizeToMenubarOnClose":false}}' > /dev/null
sleep 0.5
agent-browser --session e2e-settings open http://localhost:5173/settings
agent-browser --session e2e-settings wait --load networkidle
agent-browser --session e2e-settings snapshot -i | grep -iE "menu bar"
agent-browser --session e2e-settings click @<menubar-switch-ref>
sleep 0.5
```

**Verification**:
```bash
curl -s http://127.0.0.1:4575/settings | jq '.general.minimizeToMenubarOnClose'
# expect: true
```

**Cleanup**:
```bash
curl -s -X PATCH http://127.0.0.1:4575/settings -H "Content-Type: application/json" \
  -d '{"general":{"minimizeToMenubarOnClose":true}}' > /dev/null
```

---

## [MANUAL] SET-MENUBAR-02 — Close behaviour respects the toggle

**Goal**: With `minimizeToMenubarOnClose: true`, clicking the red X hides the window to tray (process stays alive). With it `false`, the X quits the app.

**Steps**:
1. Set toggle to ON. Click the window's red close button. Window disappears, tray icon remains, API still up.
2. Click the tray icon → window reappears.
3. Set toggle to OFF. Click the red X again. App fully quits, port 4575 frees.

**Verification**: Manual — `lsof -nP -iTCP:4575` between steps.

**Cleanup**: Relaunch via `bun start` if the app quit; reset toggle to ON.

---

## Teardown

```bash
agent-browser --session e2e-settings close
```
