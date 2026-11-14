import { useNavigate } from '@tanstack/react-router'
import { listen } from '@tauri-apps/api/event'
import { useEffect } from 'react'
import { type AgentsResponse, useAgents } from '@/modules/api/agents.hooks'
import {
  type Notification,
  type SettingsResponse,
  useMarkSeen,
  useNotifications,
  useSettings,
} from '@/modules/api/notifications.hooks'
import { queryClient } from '@/modules/api/queryClient'
import { openStream } from '@/modules/api/stream'
import { isDesktop } from '@/modules/host/host'
import { reasonFor } from '@/modules/notifications/copy'
import {
  type NotifyIntent,
  postNotification,
  setAttention,
  withdrawNotification,
} from '@/modules/notifications/shell'

/**
 * The window's half of the delivery path.
 *
 * The sidecar decides and the shell draws, but neither can reach the other:
 * the shell never talks to the sidecar, so the intent travels through here.
 * This is also why it is mounted on the layout that never unmounts rather
 * than on a screen, since every notification is about an agent the person is
 * by definition not looking at.
 */

const RECONNECT_MS = 1500

type AppSignal =
  | { type: 'notification'; notification: Notification }
  | { type: 'withdraw'; agentId: string }
  | { type: 'attention'; agentId: string; state: string }

const refreshInbox = () =>
  queryClient.invalidateQueries({ queryKey: useNotifications.getKey() })

/**
 * The banner needs what the row does not carry.
 *
 * Appearance belongs to the agent, not to the event, so the row stays about
 * what happened. Without the agent there is nothing worth guessing: a face in
 * the wrong shape says the wrong thing more clearly than no face at all.
 */
function intentFor(notification: Notification): NotifyIntent | null {
  const agents = queryClient.getQueryData<AgentsResponse>(useAgents.getKey())
  const agent = agents?.agents.find((a) => a.id === notification.agentId)
  if (!agent) return null

  const settings = queryClient.getQueryData<SettingsResponse>(
    useSettings.getKey(),
  )

  return {
    id: notification.id,
    agentId: notification.agentId,
    title: notification.title,
    subtitle: reasonFor(notification.kind, notification.reason),
    body: notification.body,
    route: notification.route,
    updates: notification.updates,
    kind: notification.kind,
    shape: agent.shape,
    color: agent.color,
    sound: settings?.settings['notify.sound'] !== '0',
  }
}

function handle(signal: AppSignal): void {
  if (signal.type === 'notification') {
    const intent = intentFor(signal.notification)
    if (intent) void postNotification(intent)
    void refreshInbox()
    return
  }
  if (signal.type === 'withdraw') {
    void withdrawNotification(signal.agentId)
    void refreshInbox()
    return
  }
  // An attention move is not itself a notification, but it is what the rail
  // draws, and the rail reads the inbox.
  void refreshInbox()
}

/** Relays the app stream to the shell, and keeps the badge honest. */
export function useNotificationBridge(): void {
  const { data } = useNotifications()
  const waiting = data?.waiting.length ?? 0

  // An SSE connection is an external system with a lifetime of its own, and
  // this one deliberately has no dependencies: it outlives every navigation.
  useEffect(() => {
    let closed = false
    let close = () => {}
    let retry: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      close = openStream('/api/notifications/stream', {
        onEvent: (_event, raw) => handle(JSON.parse(raw) as AppSignal),
        onClose: (aborted) => {
          if (aborted || closed) return
          retry = setTimeout(connect, RECONNECT_MS)
        },
      })
    }
    connect()

    return () => {
      closed = true
      clearTimeout(retry)
      close()
    }
  }, [])

  // The dock and the menu bar are outside React, so they are told rather than
  // rendered.
  useEffect(() => {
    void setAttention(waiting)
  }, [waiting])
}

/**
 * A clicked banner, which the shell has already brought the window back for.
 *
 * Marking it seen here rather than in Rust keeps every seen path in one
 * place, and the route is taken from the payload so the window lands on the
 * thread the notification was about even if the rail has since re-ordered.
 */
export function useNotificationClicks(): void {
  const navigate = useNavigate()
  const { mutate: markSeen } = useMarkSeen()

  useEffect(() => {
    if (!isDesktop()) return
    let unlisten: (() => void) | undefined
    let stopped = false

    void listen<{ id: string; route: string; agentId: string }>(
      'notification://open',
      (event) => {
        const { id, agentId } = event.payload
        void navigate({ to: '/agents/$agentId', params: { agentId } })
        markSeen({ id })
      },
    ).then((off) => {
      if (stopped) off()
      else unlisten = off
    })

    return () => {
      stopped = true
      unlisten?.()
    }
  }, [navigate, markSeen])
}
