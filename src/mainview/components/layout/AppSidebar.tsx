import { Link, useRouterState } from '@tanstack/react-router'
import { ClockIcon, InboxIcon, PlusIcon, SettingsIcon } from 'lucide-react'
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
import {
  type ConversationSummary,
  useConversations,
} from '@/modules/api/chat.hooks'
import { useInboxItems } from '@/modules/api/inbox.hooks'
import { dayBucket } from '@/modules/utils/relativeTime'
import { ConversationRow } from './ConversationRow'

export function AppSidebar() {
  const { data: inboxItems = [] } = useInboxItems()
  const { data: conversations } = useConversations()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const unreadCount = inboxItems.filter((i) => i.status === 'unread').length

  // Pinned rows render above the dated buckets; within each group the
  // order mirrors recency (pinnedAt for pinned, updatedAt otherwise).
  const { pinned, buckets } = useMemo(() => {
    const all = conversations ?? []
    const pinnedRows = all
      .filter((c) => c.pinnedAt != null)
      .sort((a, b) => (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0))
    const unpinned = all.filter((c) => c.pinnedAt == null)
    const dated: Array<{ label: string; items: ConversationSummary[] }> = []
    for (const conv of unpinned) {
      const label = dayBucket(conv.updatedAt)
      const last = dated[dated.length - 1]
      if (last && last.label === label) last.items.push(conv)
      else dated.push({ label, items: [conv] })
    }
    return { pinned: pinnedRows, buckets: dated }
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
                  render={<Link to="/chat/new" />}
                  isActive={pathname === '/chat/new'}
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

        {pinned.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Pinned</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {pinned.map((conv) => (
                  <ConversationRow
                    key={conv.id}
                    conv={conv}
                    isActive={pathname === `/chat/${conv.id}`}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {buckets.map((bucket) => (
          <Fragment key={bucket.label}>
            <SidebarGroup>
              <SidebarGroupLabel>{bucket.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {bucket.items.map((conv) => (
                    <ConversationRow
                      key={conv.id}
                      conv={conv}
                      isActive={pathname === `/chat/${conv.id}`}
                    />
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
