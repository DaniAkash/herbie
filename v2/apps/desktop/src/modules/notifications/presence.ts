import { listen } from '@tauri-apps/api/event'
import { useEffect } from 'react'
import { api } from '@/modules/api/client'
import { isDesktop } from '@/modules/host/host'

/**
 * Whether the person is at the window, and which agent is on screen.
 *
 * Only the window knows either half, and the sidecar needs both to tell a
 * notification worth sending from one about the thread already in front of
 * someone. It is reported rather than asked for, because nothing in the
 * sidecar can see a renderer.
 *
 * The sidecar treats a report older than its ceiling as absent, so the
 * heartbeat is what keeps a live window from reading as a dead one. Erring
 * that way is deliberate: a webview that stopped reporting should cost a
 * notification too many, never silence.
 */

const HEARTBEAT_MS = 10_000
/** Long enough that a drag across agents is one report rather than six. */
const SETTLE_MS = 200

let focused = true
let viewing: string | null = null
let settle: ReturnType<typeof setTimeout> | undefined

async function send(): Promise<void> {
  try {
    const client = await api()
    await client.api.presence.$post({
      json: { focused, agentId: viewing },
    })
  } catch {
    // The sidecar is not up yet, or went away. The heartbeat carries the
    // next one, and a missed report reads as absent, which is the safe end.
  }
}

function schedule(): void {
  clearTimeout(settle)
  settle = setTimeout(() => void send(), SETTLE_MS)
}

function setFocused(next: boolean): void {
  if (next === focused) return
  focused = next
  schedule()
}

/** Wires the window's own signals and keeps reporting. Call once. */
function startPresence(): () => void {
  focused = document.hasFocus()

  const onFocus = () => setFocused(true)
  const onBlur = () => setFocused(false)
  const onVisibility = () =>
    setFocused(document.visibilityState === 'visible' && document.hasFocus())

  window.addEventListener('focus', onFocus)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)

  // The shell reports native focus, which is the authority in a window whose
  // DOM can stay focused while the window itself is behind another app.
  let unlisten: (() => void) | undefined
  let stopped = false
  if (isDesktop()) {
    void listen<boolean>('window://focus', (event) => {
      setFocused(event.payload)
    }).then((off) => {
      if (stopped) off()
      else unlisten = off
    })
  }

  const beat = setInterval(() => void send(), HEARTBEAT_MS)
  void send()

  return () => {
    stopped = true
    clearInterval(beat)
    clearTimeout(settle)
    unlisten?.()
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

/**
 * Reports presence for as long as the shell is mounted.
 *
 * Two effects rather than one: the listeners belong to the window and should
 * outlive any navigation, while the agent on screen changes with the route.
 * Keying the listeners on the agent would tear down an OS subscription every
 * time someone clicked a different conversation.
 */
export function usePresence(agentId: string | null): void {
  useEffect(() => startPresence(), [])

  useEffect(() => {
    viewing = agentId
    schedule()
  }, [agentId])
}
