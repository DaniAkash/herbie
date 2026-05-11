import { ApplicationMenu } from 'electrobun/bun'

// macOS routes Cmd+C/V/X/A through the main menu's responder chain into
// the focused webview. Without these items, WKWebView text fields receive
// no key equivalent. `role:` values map to NSResponder selectors and are
// handled natively — no JS round-trip, no clipboard prompt.
export function setupApplicationMenu(): void {
  ApplicationMenu.setApplicationMenu([
    {
      label: 'Herbie',
      submenu: [
        { role: 'about' },
        { type: 'divider' },
        { role: 'hide', accelerator: 'CmdOrCtrl+H' },
        { role: 'hideOthers', accelerator: 'CmdOrCtrl+Alt+H' },
        { role: 'showAll' },
        { type: 'divider' },
        { role: 'quit', accelerator: 'CmdOrCtrl+Q' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { role: 'redo', accelerator: 'CmdOrCtrl+Shift+Z' },
        { type: 'divider' },
        { role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { role: 'paste', accelerator: 'CmdOrCtrl+V' },
        { role: 'pasteAndMatchStyle', accelerator: 'CmdOrCtrl+Shift+Alt+V' },
        { role: 'delete' },
        { role: 'selectAll', accelerator: 'CmdOrCtrl+A' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize', accelerator: 'CmdOrCtrl+M' },
        { role: 'zoom' },
        { type: 'divider' },
        // Cmd+W closes the window — Herbie's existing close handler honors
        // the minimizeToMenubarOnClose setting, so this hides-to-menubar or
        // quits as the user configured.
        { role: 'close', accelerator: 'CmdOrCtrl+W' },
        { type: 'divider' },
        { role: 'toggleFullScreen', accelerator: 'Ctrl+Cmd+F' },
      ],
    },
  ])
}
