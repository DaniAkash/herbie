/**
 * The window's own strip. Draggable in Tauri, inert in a browser tab.
 */
export function Titlebar({ title }: { title: string }) {
  return (
    <div
      data-tauri-drag-region
      className="flex items-center gap-2.5 px-4 py-2.5"
    >
      <div className="flex gap-2 pr-1">
        <span className="size-[11px] rounded-full bg-[#ff5f57]" />
        <span className="size-[11px] rounded-full bg-[#febc2e]" />
        <span className="size-[11px] rounded-full bg-[#28c840]" />
      </div>
      <span className="font-medium text-[13px] text-ink-3">{title}</span>
    </div>
  )
}
