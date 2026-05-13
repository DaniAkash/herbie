'use client'

import { Link } from '@tanstack/react-router'
import {
  MessageSquareIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  Trash2Icon,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import {
  type ConversationSummary,
  useToggleConversationPin,
} from '@/modules/api/chat.hooks'
import { DeleteConversationDialog } from './DeleteConversationDialog'
import { RenameConversationDialog } from './RenameConversationDialog'

export function ConversationRow({
  conv,
  isActive,
}: {
  conv: ConversationSummary
  isActive: boolean
}) {
  const row = (
    <SidebarMenuButton
      render={<Link to="/chat/$id" params={{ id: conv.id }} />}
      isActive={isActive}
      size="sm"
    >
      <ConversationIcon conv={conv} />
      <span className="truncate">{conv.title}</span>
    </SidebarMenuButton>
  )

  return (
    <SidebarMenuItem>
      {conv.origin === 'chat' ? (
        <ConversationContextMenu conv={conv}>{row}</ConversationContextMenu>
      ) : (
        row
      )}
    </SidebarMenuItem>
  )
}

function ConversationIcon({ conv }: { conv: ConversationSummary }) {
  // Order matters: streaming wins over unread because the animation
  // implies fresher activity than the dot.
  if (conv.status === 'streaming') return <TypingDots />
  if (conv.unread) return <UnreadDot />
  return <MessageSquareIcon />
}

function TypingDots() {
  return (
    <span
      role="img"
      aria-label="Agent is working"
      className="inline-flex size-4 items-center justify-center gap-0.5"
    >
      <span className="size-1 animate-typing-dot rounded-full bg-current" />
      <span className="size-1 animate-typing-dot rounded-full bg-current [animation-delay:120ms]" />
      <span className="size-1 animate-typing-dot rounded-full bg-current [animation-delay:240ms]" />
    </span>
  )
}

function UnreadDot() {
  return (
    <span
      role="img"
      aria-label="Unread"
      className="inline-flex size-4 items-center justify-center"
    >
      <span className="size-2 rounded-full bg-primary" />
    </span>
  )
}

function ConversationContextMenu({
  conv,
  children,
}: {
  conv: ConversationSummary
  children: ReactNode
}) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const togglePin = useToggleConversationPin()
  const isPinned = conv.pinnedAt != null

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger render={<div />}>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuItem onClick={() => setRenameOpen(true)}>
              <PencilIcon data-icon="inline-start" />
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                togglePin.mutate({ id: conv.id, pinned: !isPinned })
              }
            >
              {isPinned ? (
                <PinOffIcon data-icon="inline-start" />
              ) : (
                <PinIcon data-icon="inline-start" />
              )}
              {isPinned ? 'Unpin' : 'Pin'}
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon data-icon="inline-start" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <RenameConversationDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        conv={conv}
      />
      <DeleteConversationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        conv={conv}
      />
    </>
  )
}
