import { useState } from 'react'
import { TelegramIcon } from '@/components/icons/TelegramIcon'
import { InputGroupButton } from '@/components/ui/input-group'
import { useConversations } from '@/modules/api/chat.hooks'
import { SendToTelegramDialog } from './SendToTelegramDialog'

// Composer toolbar button that opens the Send-to-Telegram dialog.
// Hidden until a conversation exists in the unified /chat list. Pulls
// the conversation summary (including telegramLink + agent/model
// tuple) directly here so the composer doesn't have to plumb it
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
  const label = linked
    ? `Linked: @${conv.telegramLink?.botUsername ?? conv.telegramLink?.botName ?? 'bot'}`
    : 'Send to Telegram'

  return (
    <>
      <InputGroupButton
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
      </InputGroupButton>
      <SendToTelegramDialog conv={conv} open={open} onOpenChange={setOpen} />
    </>
  )
}
