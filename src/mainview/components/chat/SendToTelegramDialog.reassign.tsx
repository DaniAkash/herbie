import { ArrowLeftIcon, TriangleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  type ConversationSummary,
  useConversations,
} from '@/modules/api/chat.hooks'
import {
  formatBotLabel,
  type TelegramConnection,
} from '@/modules/api/telegram.hooks'

// Step 2b: warning shown before reassigning an already-assigned bot.
// Names the conversation that will be detached, the new one that
// will be linked, and the user-visible consequences. Confirm fires
// POST /telegram/connections/:id/reassign, which atomically swaps
// defaultConversationId and posts a notice to every Telegram chat
// the bot is in.
export function ReassignConfirmStep({
  conv,
  bot,
  isSubmitting,
  onBack,
  onConfirm,
}: {
  conv: ConversationSummary
  bot: TelegramConnection
  isSubmitting: boolean
  onBack: () => void
  onConfirm: () => Promise<void>
}) {
  const conversations = useConversations()
  const previous = conversations.data?.find(
    (c) => c.id === bot.defaultConversationId,
  )
  const previousTitle = previous?.title ?? 'an existing conversation'
  const botLabel = formatBotLabel(bot)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-amber-700 text-xs leading-relaxed dark:text-amber-300">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
        <div className="flex-1">
          <div className="font-medium text-sm">Reassign {botLabel}?</div>
          <p className="mt-1">
            {botLabel} is currently linked to{' '}
            <span className="font-medium">"{previousTitle}"</span>.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 px-3 py-3 text-xs leading-relaxed">
        <div className="font-medium text-sm">Reassigning will:</div>
        <ul className="mt-2 flex flex-col gap-1 pl-5 [&>li]:list-disc">
          <li>
            Detach <span className="font-medium">"{previousTitle}"</span> from
            Telegram. It stays in your sidebar but isn't reachable from{' '}
            {botLabel} anymore.
          </li>
          <li>
            Link <span className="font-medium">"{conv.title}"</span> to{' '}
            {botLabel}.
          </li>
          <li>
            Post a notice in the Telegram chat so the other end sees the switch.
          </li>
        </ul>
      </div>

      <div className="flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Reassigning…' : 'Reassign anyway'}
        </Button>
      </div>
    </div>
  )
}
