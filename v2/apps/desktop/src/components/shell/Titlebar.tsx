/**
 * The strip the window is dragged by.
 *
 * Deliberately empty. The window runs with `titleBarStyle: "Overlay"`, so
 * macOS draws the real traffic lights on top of the webview at the top left,
 * and anything rendered here would sit underneath them.
 *
 * 28px is the standard macOS title bar height. The controls measure 16px tall
 * at an 8px inset, so they end 24px down and this clears them by 4px. Taller
 * than that is dead space, shorter clips the hit targets.
 *
 * `data-tauri-drag-region` is a plain attribute the Tauri runtime looks for,
 * so this renders and lays out identically in a browser tab, where there is
 * no window to drag and nothing to read it.
 */
export function Titlebar() {
  return <div data-tauri-drag-region className="h-7 shrink-0" />
}
