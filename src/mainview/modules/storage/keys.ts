// All renderer-side persistent storage keys live here. Adding a new
// localStorage / sessionStorage write? Put the key here first so the
// prefix convention stays consistent and future migrations have one
// place to look.
//
// Convention: `herbie:<area>[:<sub>]` — colon-separated, always
// prefixed with `herbie:`. Avoid embedding mutable IDs in the prefix
// hierarchy itself; use them as the last segment so the prefix tree
// stays scannable.
//
// Shadcn's vendored sidebar primitive uses its own `sidebar_state`
// cookie (see components/ui/sidebar.tsx) — that's library code, not
// first-party storage, and stays untouched.
export const STORAGE_KEYS = {
  /** Width of the primary sidebar in pixels. Persisted on drag end. */
  sidebarWidth: 'herbie:sidebar-width',

  /**
   * Last visited route (pathname + search), restored on app launch
   * after tray reopen. Cleared by `safeRestoreRoute` if the stored
   * value fails its sanity checks.
   */
  lastRoute: 'herbie:last-route',

  /** Open/closed state per Telegram bot connection in the sidebar. */
  telegramConnectionOpen: (connectionId: string): string =>
    `herbie:telegram-conn:${connectionId}:open`,

  /**
   * Last-acked chat event `seq` per conversation. Used by
   * useChatLiveStream to decide where to resume the SSE.
   *
   * Format note: this key uses dots (`herbie.chat.<id>.lastSeq`)
   * rather than colons because it predates the convention. Renaming
   * would lose previously-stored cursors and re-emit recent events
   * on first launch after upgrade — accept the inconsistency.
   */
  chatCursor: (conversationId: string): string =>
    `herbie.chat.${conversationId}.lastSeq`,
} as const
