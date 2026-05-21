import { ArrowLeftIcon, TriangleAlertIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      <Alert>
        <TriangleAlertIcon />
        <AlertTitle>Reassign {botLabel}?</AlertTitle>
        <AlertDescription>
          {botLabel} is currently linked to{' '}
          <span className="font-medium text-foreground">"{previousTitle}"</span>
          .
        </AlertDescription>
      </Alert>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Reassigning will:</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed">
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
              Post a notice in the Telegram chat so the other end sees the
              switch.
            </li>
          </ul>
        </CardContent>
      </Card>

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
