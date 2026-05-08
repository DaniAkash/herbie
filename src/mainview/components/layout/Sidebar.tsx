import { Link, useRouterState } from '@tanstack/react-router'
import {
  ClockIcon,
  InboxIcon,
  MessageSquareIcon,
  PlusIcon,
  SettingsIcon,
} from 'lucide-react'
import { Fragment, useMemo } from 'react'
import { LinkButton } from '@/components/ui/link-button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import { dayBucket } from '@/modules/utils/relativeTime'

export function Sidebar() {
  const { conversations, inboxItems } = useHerbieData()
  const router = useRouterState({ select: (s) => s.location.pathname })

  const unreadCount = inboxItems.filter((i) => i.status === 'unread').length

  const grouped = useMemo(() => {
    const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
    const buckets: Array<{ label: string; items: typeof sorted }> = []
    for (const conv of sorted) {
      const label = dayBucket(conv.updatedAt)
      const last = buckets[buckets.length - 1]
      if (last && last.label === label) last.items.push(conv)
      else buckets.push({ label, items: [conv] })
    }
    return buckets
  }, [conversations])

  return (
    <aside className="flex h-full w-64 flex-col border-border border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="font-semibold tracking-tight">Herbie</span>
      </div>

      <div className="px-3 pb-2">
        <LinkButton
          to="/c/new"
          className="w-full justify-start gap-2"
          size="sm"
        >
          <PlusIcon className="h-4 w-4" />
          New chat
        </LinkButton>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 pb-2">
        <NavItem
          to="/inbox"
          icon={<InboxIcon className="h-4 w-4" />}
          label="Inbox"
          active={router.startsWith('/inbox')}
          badge={unreadCount > 0 ? unreadCount : undefined}
        />
        <NavItem
          to="/tasks"
          icon={<ClockIcon className="h-4 w-4" />}
          label="Tasks"
          active={router.startsWith('/tasks')}
        />
      </nav>

      <Separator className="mx-3 my-2 w-auto" />

      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-3 pb-4">
          {grouped.length === 0 ? (
            <p className="px-2 py-4 text-muted-foreground text-xs">
              No chats yet
            </p>
          ) : (
            grouped.map((bucket) => (
              <Fragment key={bucket.label}>
                <p className="px-2 pt-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  {bucket.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {bucket.items.map((conv) => (
                    <NavItem
                      key={conv.id}
                      to="/c/$id"
                      params={{ id: conv.id }}
                      icon={
                        <MessageSquareIcon className="h-3.5 w-3.5 shrink-0" />
                      }
                      label={conv.title}
                      active={router === `/c/${conv.id}`}
                      compact
                    />
                  ))}
                </div>
              </Fragment>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="border-border border-t px-3 py-2">
        <NavItem
          to="/settings"
          icon={<SettingsIcon className="h-4 w-4" />}
          label="Settings"
          active={router.startsWith('/settings')}
        />
      </div>
    </aside>
  )
}

type NavItemProps = {
  to: string
  params?: Record<string, string>
  icon: React.ReactNode
  label: string
  active?: boolean
  badge?: number
  compact?: boolean
}

function NavItem({
  to,
  params,
  icon,
  label,
  active,
  badge,
  compact,
}: NavItemProps) {
  return (
    <Link
      to={to}
      params={params as never}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        compact && 'py-1 text-[13px]',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && (
        <span className="rounded-full bg-primary px-1.5 py-0.5 font-medium text-[11px] text-primary-foreground">
          {badge}
        </span>
      )}
    </Link>
  )
}
