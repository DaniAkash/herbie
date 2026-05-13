import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronRightIcon, MessageSquareIcon, SendIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import {
  type TelegramChatsEntry,
  type TelegramChatsGroup,
  useTelegramChats,
} from '@/modules/api/telegram.hooks'

// localStorage keys are stable so the user's open/closed choices
// survive a reload. The chevron rotation is purely visual; the value
// here is the source of truth.
const KEY_ROOT = 'sidebar:external-chats:open'
const KEY_TELEGRAM = 'sidebar:external-chats:telegram:open'
const KEY_CONN = (id: string) =>
  `sidebar:external-chats:telegram:conn:${id}:open`

export function ExternalChatsGroup() {
  const { data, isLoading } = useTelegramChats()
  const groups = data ?? []
  const [rootOpen, setRootOpen] = usePersistedOpen(KEY_ROOT, true)
  const [tgOpen, setTgOpen] = usePersistedOpen(KEY_TELEGRAM, true)

  // Hide entirely if there are no connections AND we're not still
  // loading. Empty-state UX for the sidebar is just "no group at all"
  // — settings is where the user adds connections.
  if (!isLoading && groups.length === 0) return null

  // If every connection has zero chats, skip the group too. Users
  // who haven't received a message yet don't need an empty branch
  // taking up sidebar real estate.
  const totalChats = groups.reduce((n, g) => n + g.chats.length, 0)
  if (!isLoading && totalChats === 0) return null

  return (
    <Collapsible open={rootOpen} onOpenChange={setRootOpen}>
      <SidebarGroup>
        <CollapsibleTrigger
          render={
            <SidebarGroupLabel
              className="cursor-pointer hover:text-sidebar-foreground"
              data-open={rootOpen}
            />
          }
        >
          <ChevronRightIcon
            className={cn(
              'mr-1 size-3 shrink-0 transition-transform',
              rootOpen && 'rotate-90',
            )}
          />
          External Chats
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              <TelegramSubGroup
                groups={groups}
                open={tgOpen}
                onOpenChange={setTgOpen}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

function TelegramSubGroup({
  groups,
  open,
  onOpenChange,
}: {
  groups: TelegramChatsGroup[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const totalUnread = groups.reduce(
    (n, g) => n + g.chats.reduce((m, c) => m + c.unreadCount, 0),
    0,
  )
  return (
    // base-ui's Collapsible renders a <div> by default; using `render`
    // lets us wrap a <li> (SidebarMenuItem) so we don't put a <div>
    // inside the parent <ul> (SidebarMenu).
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger render={<SidebarMenuButton />}>
        <SendIcon />
        <span className="flex-1">Telegram</span>
        <ChevronRightIcon
          className={cn(
            'size-3 shrink-0 transition-transform',
            open && 'rotate-90',
          )}
        />
      </CollapsibleTrigger>
      {!open && totalUnread > 0 && (
        <SidebarMenuBadge className="bg-primary text-primary-foreground">
          {totalUnread}
        </SidebarMenuBadge>
      )}
      <CollapsibleContent>
        <SidebarMenuSub>
          {groups.map((g) => (
            <ConnectionBranch key={g.connection.id} group={g} />
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ConnectionBranch({ group }: { group: TelegramChatsGroup }) {
  const [open, setOpen] = usePersistedOpen(KEY_CONN(group.connection.id), true)
  const totalUnread = group.chats.reduce((n, c) => n + c.unreadCount, 0)
  const username = group.connection.botUsername
    ? `@${group.connection.botUsername}`
    : group.connection.name

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<SidebarMenuSubItem />}
    >
      <CollapsibleTrigger render={<SidebarMenuSubButton />}>
        <ChevronRightIcon
          className={cn(
            'size-3 shrink-0 transition-transform',
            open && 'rotate-90',
          )}
        />
        <span className="flex-1 truncate font-mono text-[11px]">
          {username}
        </span>
        {!open && totalUnread > 0 && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">
            {totalUnread}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {group.chats.length === 0 ? (
            <SidebarMenuSubItem>
              <span className="px-2 py-1 text-[11px] text-muted-foreground italic">
                No chats yet
              </span>
            </SidebarMenuSubItem>
          ) : (
            group.chats.map((chat) => <ChatLeaf key={chat.id} chat={chat} />)
          )}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ChatLeaf({ chat }: { chat: TelegramChatsEntry }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const href = `/chat/${chat.conversationId}`
  const isActive = pathname === href
  const label =
    chat.chatTitle ||
    chat.conversationTitle ||
    `chat ${chat.telegramChatId.slice(-6)}`

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        render={<Link to="/chat/$id" params={{ id: chat.conversationId }} />}
        isActive={isActive}
        size="sm"
      >
        <MessageSquareIcon />
        <span className="flex-1 truncate">{label}</span>
        {chat.unreadCount > 0 && !isActive && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">
            {chat.unreadCount}
          </span>
        )}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

// Tiny persisted-toggle hook. Reads once on mount, writes on every
// change. Falls back to `initial` if there's no entry or
// JSON.parse fails (safe across schema bumps).
function usePersistedOpen(
  key: string,
  initial: boolean,
): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => readBool(key, initial))
  useEffect(() => {
    // Re-read when the key changes (e.g. different connection id).
    setValue(readBool(key, initial))
  }, [key, initial])
  const set = useCallback(
    (v: boolean) => {
      setValue(v)
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        // SSR or quota-exceeded — keep the in-memory value.
      }
    },
    [key],
  )
  return [value, set]
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) === true
  } catch {
    return fallback
  }
}
