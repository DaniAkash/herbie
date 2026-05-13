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

// localStorage key per connection; used only when a bot has more
// than one chat (rare today since most bots are 1:1 DMs).
const KEY_CONN = (id: string) => `sidebar:telegram:conn:${id}:open`

export function TelegramSidebarGroup() {
  const { data, isLoading } = useTelegramChats()
  const groups = data ?? []

  // Hide the group entirely until at least one bot has a chat.
  // Settings is where the user lives to add connections; an empty
  // section header would just be noise.
  const totalChats = groups.reduce((n, g) => n + g.chats.length, 0)
  if (!isLoading && totalChats === 0) return null

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Telegram</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {groups.map((g) => (
            <ConnectionRow key={g.connection.id} group={g} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

// One row per connection. Two shapes:
//  - exactly one chat → the row IS the chat (clicks open it).
//  - more than one chat → collapsible parent with sub-items.
// Bots with zero chats are hidden until their first message arrives.
function ConnectionRow({ group }: { group: TelegramChatsGroup }) {
  if (group.chats.length === 0) return null
  if (group.chats.length === 1) return <SingleChatBotRow group={group} />
  return <MultiChatBotRow group={group} />
}

function SingleChatBotRow({ group }: { group: TelegramChatsGroup }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const chat = group.chats[0]
  if (!chat) return null
  const href = `/chat/${chat.conversationId}`
  const isActive = pathname === href
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link to="/chat/$id" params={{ id: chat.conversationId }} />}
        isActive={isActive}
      >
        <SendIcon />
        <span className="truncate">{botLabel(group)}</span>
      </SidebarMenuButton>
      {chat.unreadCount > 0 && !isActive && (
        <SidebarMenuBadge className="bg-primary text-primary-foreground">
          {chat.unreadCount}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  )
}

function MultiChatBotRow({ group }: { group: TelegramChatsGroup }) {
  const [open, setOpen] = usePersistedOpen(KEY_CONN(group.connection.id), true)
  const totalUnread = group.chats.reduce((n, c) => n + c.unreadCount, 0)
  return (
    // base-ui Collapsible defaults to <div>; render={<SidebarMenuItem />}
    // makes it render as <li> so we don't put a div inside a ul.
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger render={<SidebarMenuButton />}>
        <SendIcon />
        <span className="flex-1 truncate">{botLabel(group)}</span>
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
          {group.chats.map((chat) => (
            <ChatLeaf key={chat.id} chat={chat} />
          ))}
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

function botLabel(group: TelegramChatsGroup): string {
  return group.connection.botUsername
    ? `@${group.connection.botUsername}`
    : group.connection.name
}

function usePersistedOpen(
  key: string,
  initial: boolean,
): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => readBool(key, initial))
  useEffect(() => {
    setValue(readBool(key, initial))
  }, [key, initial])
  const set = useCallback(
    (v: boolean) => {
      setValue(v)
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        // quota-exceeded — keep the in-memory value.
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
