import { Link, useRouterState } from '@tanstack/react-router'
import {
  ClockIcon,
  InboxIcon,
  MessageSquareIcon,
  PlusIcon,
  SettingsIcon,
} from 'lucide-react'
import { Fragment, useMemo } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import { dayBucket } from '@/modules/utils/relativeTime'

export function AppSidebar() {
  const { conversations, inboxItems } = useHerbieData()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

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
    <Sidebar className="border-r">
      <SidebarHeader className="electrobun-webkit-app-region-drag px-3 pt-9 pb-2">
        <div className="flex items-center justify-between px-1">
          <span className="font-semibold text-base tracking-tight">Herbie</span>
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            v0.1
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/c/new" />}
                  isActive={pathname === '/c/new'}
                  className="font-medium"
                >
                  <PlusIcon />
                  <span>New chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/inbox" />}
                  isActive={pathname.startsWith('/inbox')}
                >
                  <InboxIcon />
                  <span>Inbox</span>
                </SidebarMenuButton>
                {unreadCount > 0 && (
                  <SidebarMenuBadge className="bg-primary text-primary-foreground">
                    {unreadCount}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/tasks" />}
                  isActive={pathname.startsWith('/tasks')}
                >
                  <ClockIcon />
                  <span>Tasks</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {grouped.map((bucket) => (
          <Fragment key={bucket.label}>
            <SidebarGroup>
              <SidebarGroupLabel>{bucket.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {bucket.items.map((conv) => (
                    <SidebarMenuItem key={conv.id}>
                      <SidebarMenuButton
                        render={<Link to="/c/$id" params={{ id: conv.id }} />}
                        isActive={pathname === `/c/${conv.id}`}
                        size="sm"
                      >
                        <MessageSquareIcon />
                        <span className="truncate">{conv.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </Fragment>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/settings" />}
              isActive={pathname.startsWith('/settings')}
            >
              <SettingsIcon />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
