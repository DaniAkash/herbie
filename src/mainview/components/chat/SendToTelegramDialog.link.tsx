import { Loader2Icon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useConversations } from '@/modules/api/chat.hooks'
import { queryClient } from '@/modules/api/queryClient'
import {
  type CreateLinkResponse,
  usePollTelegramLink,
} from '@/modules/api/telegram.hooks'

// Step 3: render the deep link the user opens on Telegram, and wait
// for them to tap START. This step OWNS the completion detection
// (no parent cache-watching), via three signals:
//
//   1. usePollTelegramLink — token endpoint. 'pending' while the
//      handshake is open, 'gone' once consumed or expired.
//   2. useConversations — when the bot consumes the token, it
//      writes telegramLink for our conversation. When token goes
//      'gone' we kick a refetch and watch for that link.
//   3. Time — the link has expiresAt; we show a quiet countdown.
//
// When telegramLink for this conversation matches the bot we minted
// for, we fire onLinked exactly once.
export function LinkStep({
  conversationId,
  connectionId,
  link,
  via,
  onLinked,
  onCancel,
}: {
  conversationId: string
  connectionId: string
  link: CreateLinkResponse
  via: 'new' | 'existing'
  onLinked: () => void
  onCancel: () => void
}) {
  const poll = usePollTelegramLink({
    variables: { token: link.token },
    enabled: !!link.token,
  })
  const conversations = useConversations()
  const tokenGone = poll.data?.status === 'gone'
  const firedRef = useRef(false)

  // When the token goes 'gone', force a conversations refetch so the
  // link-confirmation check below sees the freshest cache instead of
  // a stale snapshot from the last invalidation.
  useEffect(() => {
    if (!tokenGone) return
    queryClient.invalidateQueries({ queryKey: useConversations.getKey() })
  }, [tokenGone])

  // Fire onLinked the moment the conversation shows a link to the
  // bot we minted this token for. Compare on connectionId (passed
  // through by the dialog from startLinkFlow) — unambiguous and
  // doesn't rely on botUsername equality. Idempotent via firedRef
  // since react-query may re-settle before the parent unmounts us.
  const fresh = conversations.data?.find((c) => c.id === conversationId)
  const linkedHere = fresh?.telegramLink?.connectionId === connectionId
  useEffect(() => {
    if (firedRef.current) return
    if (!linkedHere) return
    firedRef.current = true
    onLinked()
  }, [linkedHere, onLinked])

  const url = link.deepLinkUrl
  const botLabel = link.botUsername ? `@${link.botUsername}` : 'your bot'
  const expired = tokenGone && !linkedHere

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
