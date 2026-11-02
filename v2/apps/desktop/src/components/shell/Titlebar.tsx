/**
 * The strip the window is dragged by.
 *
 * Deliberately empty. The window runs with `titleBarStyle: "Overlay"`, so
 * macOS draws the real traffic lights on top of the webview at the top left,
 * and anything rendered here would sit underneath them. The height is what
 * clears those controls.
 *
 * `data-tauri-drag-region` is a plain attribute the Tauri runtime looks for,
 * so this renders and lays out identically in a browser tab, where there is
 * no window to drag and nothing to read it.
 */
export function Titlebar() {
  return <div data-tauri-drag-region className="h-10 shrink-0" />
}
