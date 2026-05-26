import { TriangleAlertIcon } from 'lucide-react'

// Fires above the composer when the user has picked a new agent or
// workspace on a conversation with prior turns — i.e. when the next
// send would trigger Path A in the router (provider rebuild + the
// transcript-replay that strips tools / reasoning blocks). Model and
// reasoning changes take Path C in the router and do NOT show this
// banner; see Composer.tsx for the wouldTriggerReplay logic.
//
// Undo reverts the tuple to whatever the user landed on the
// conversation with. The parent's eager-PATCH wrapper persists the
// revert to the conversation row.
export function SwitchWarning({
  onUndo,
  onDismiss,
}: {
  onUndo: () => void
  onDismiss: () => void
}) {
  return (
    <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-700 text-xs dark:text-amber-400">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1 leading-relaxed">
        Switching agent / workspace replays the full conversation to the new
        context. The new agent's first response loses prompt cache and some
        context nuance.
      </p>
      <button
        type="button"
        onClick={onUndo}
        className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 text-xs hover:bg-amber-500/20 dark:text-amber-400"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss warning"
        className="text-amber-700/70 hover:text-amber-700 dark:text-amber-400/70 dark:hover:text-amber-400"
      >
        ✕
      </button>
    </div>
  )
}
