import { Link, useNavigate } from '@tanstack/react-router'
import { AgentFace } from '@/components/agent/AgentFace'
import { Overlay } from '@/components/shell/Overlay'
import { PanelSection } from '@/components/shell/Rows'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAgents } from '@/modules/api/agents.hooks'
import {
  type Notification,
  useDismiss,
  useNotifications,
  useSeeAgent,
} from '@/modules/api/notifications.hooks'
import { closeOverlay } from '@/modules/navigation/overlay'
import { faceForKind } from '@/modules/notifications/attention'
import { agoFrom, reasonFor } from '@/modules/notifications/copy'

/**
 * What happened while you were not looking.
 *
 * Every notification is written here whether or not a banner ever reached the
 * screen, which is what makes a refused permission in System Settings degrade
 * the feature instead of silencing it.
 */
export function NotificationsOverlay() {
  const { data, isPending, isError } = useNotifications()
  const { data: agentsData } = useAgents()
  const navigate = useNavigate()
  const seeAgent = useSeeAgent()
  const dismiss = useDismiss()

  const notifications = data?.notifications ?? []
  const waiting = data?.waiting ?? []
  const now = Date.now()

  const open = (notification: Notification) => {
    seeAgent.mutate({ agentId: notification.agentId })
    void navigate({
      to: '/agents/$agentId',
      params: { agentId: notification.agentId },
      search: closeOverlay,
    })
  }

  return (
    <Overlay
      title="Notifications"
      footer={
        <>
          {waiting.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                for (const agentId of waiting) seeAgent.mutate({ agentId })
              }}
            >
              Mark all read
            </Button>
          ) : null}
          <Link to="." search={closeOverlay}>
            <Button size="sm" variant="secondary">
              Done
            </Button>
          </Link>
        </>
      }
    >
      {isPending ? <p className="text-ink-3">Reading the inbox...</p> : null}
      {isError ? <p className="text-red">The sidecar did not answer.</p> : null}
      {seeAgent.isError || dismiss.isError ? (
        <p className="mb-3 text-red">That did not save. Try again.</p>
      ) : null}

      {!isPending && !isError && notifications.length === 0 ? (
        <p className="text-[13px] text-ink-2">
          Nothing yet. When an agent needs you while you are away, it lands
          here.
        </p>
      ) : null}

      {notifications.length > 0 ? (
        <PanelSection>
          {notifications.map((notification) => {
            const agent = agentsData?.agents.find(
              (a) => a.id === notification.agentId,
            )
            const unread =
              notification.seenAt === null && notification.dismissedAt === null
            return (
              <div
                key={notification.id}
                className={cn(
                  'flex items-start gap-3 px-3.5 py-3',
                  unread && 'bg-accent-tint/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => open(notification)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  {agent ? (
                    <AgentFace
                      color={agent.color}
                      shape={agent.shape}
                      size="md"
                      state={faceForKind(notification.kind)}
                    />
                  ) : (
                    <span className="size-7 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-[13px]">
                        {notification.title}
                      </span>
                      {unread ? (
                        <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-ink-3">
                      {reasonFor(notification.kind, notification.reason)}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-ink-2 leading-snug">
                      {notification.body}
                    </span>
                  </span>
                </button>
                <span className="flex shrink-0 items-center gap-2 pt-0.5">
                  <span className="text-[11px] text-ink-3">
                    {agoFrom(notification.createdAt, now)}
                  </span>
                  {unread ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      aria-label="Dismiss"
                      onClick={() => dismiss.mutate({ id: notification.id })}
                    >
                      Dismiss
                    </Button>
                  ) : null}
                </span>
              </div>
            )
          })}
        </PanelSection>
      ) : null}
    </Overlay>
  )
}
