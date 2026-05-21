import { useState } from 'react'
import { TelegramIcon } from '@/components/icons/TelegramIcon'
import { Button } from '@/components/ui/button'
import { useConversations } from '@/modules/api/chat.hooks'
import { formatBotLabel } from '@/modules/api/telegram.hooks'
import { SendToTelegramDialog } from './SendToTelegramDialog'

// Conversation-level action exposed below the composer (alongside
// Schedule). Hidden until a conversation exists in the unified /chat
// list. Pulls the conversation summary (including telegramLink +
// agent/model tuple) directly so callers don't have to plumb it
// through.
export function SendToTelegramButton({
  conversationId,
  disabled,
}: {
  conversationId: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const { data: conversations } = useConversations()
  const conv = conversations?.find((c) => c.id === conversationId)
  if (!conv) return null

  const linked = !!conv.telegramLink
  const label = conv.telegramLink
    ? `Linked: ${formatBotLabel(conv.telegramLink)}`
    : 'Send to Telegram'

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={
          linked
            ? 'Already linked to a Telegram bot. Click to manage.'
            : 'Open this conversation from Telegram on your phone'
        }
      >
        <TelegramIcon data-icon="inline-start" />
        {label}
      </Button>
      <SendToTelegramDialog conv={conv} open={open} onOpenChange={setOpen} />
    </>
  )
}
