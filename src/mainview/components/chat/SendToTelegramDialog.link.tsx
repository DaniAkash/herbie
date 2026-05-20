import { Loader2Icon } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  type CreateLinkResponse,
  usePollTelegramLink,
} from '@/modules/api/telegram.hooks'

// Step 3: render the deep link the user opens on Telegram. While the
// dialog is on this screen, we poll the token endpoint — once the
// bot consumes it (or it expires), we react accordingly. Actual
// success is detected by the parent watching the conversation's
// telegramLink in GET /chat; this step's polling just covers the
// 'expired' transition.
export function LinkStep({
  link,
  via,
  onCancel,
}: {
  link: CreateLinkResponse
  via: 'new' | 'existing'
  onCancel: () => void
}) {
  const poll = usePollTelegramLink({
    variables: { token: link.token },
    enabled: !!link.token,
  })
  const status = poll.data?.status
  const expired = status === 'gone'

  // Stop polling once the token is gone (consumed or expired). The
  // parent dialog's separate effect catches the success case via the
  // conversation's telegramLink update; here we just freeze the UI.
  useEffect(() => {
    if (status === 'gone') poll.refetch().catch(() => {})
  }, [status, poll.refetch])

  const url = link.deepLinkUrl
  const botLabel = link.botUsername ? `@${link.botUsername}` : 'your bot'

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-muted/40 px-4 py-4">
        <p className="text-sm leading-relaxed">
          {via === 'new'
            ? `New bot created. Open ${botLabel} on Telegram and tap START to finish linking.`
            : `Open ${botLabel} on Telegram and tap START to link this conversation.`}
        </p>
      </div>

      {url ? (
        <Button
          type="button"
          size="lg"
          render={
            <a href={url} target="_blank" rel="noreferrer">
              🔗 Open {botLabel} on Telegram
            </a>
          }
        />
      ) : (
        <p className="text-destructive text-sm">
          Bot has no username — can't generate a deep link. Set one via
          @BotFather first.
        </p>
      )}

      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {expired ? (
          <span>⚠ Link expired or already used.</span>
        ) : (
          <>
            <Loader2Icon className="size-3 animate-spin" />
            <span>
              Waiting for you to tap START in Telegram… link expires in 30 min.
            </span>
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {expired ? 'Close' : 'Cancel'}
        </Button>
      </div>
    </div>
  )
}
