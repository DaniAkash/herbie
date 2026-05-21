import { PlusIcon, TriangleAlertIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ConversationSummary } from '@/modules/api/chat.hooks'
import {
  formatBotLabel,
  type TelegramConnection,
  useTelegramConnections,
} from '@/modules/api/telegram.hooks'

// Step 1: choose how to send. Lists existing special-purpose bots
// (showing what they're currently assigned to, if anything) and a
// "Create new bot" option. Remote-control bots are intentionally
// omitted from the picker — Send-to-Telegram creates SP flows; users
// add conversations to their Remote Control bot from inside Telegram
// via /new, not from the desktop.
export function PickBotStep({
  conv,
  onPickUnassigned,
  onPickAssigned,
  onCreateNew,
}: {
  conv: ConversationSummary
  onPickUnassigned: (bot: TelegramConnection) => void
  onPickAssigned: (bot: TelegramConnection) => void
  onCreateNew: () => void
}) {
  const { data: connections = [] } = useTelegramConnections()
  const specialPurpose = connections.filter((c) => c.kind === 'special_purpose')

  // Conversation may already be reachable from a bot — by kind:
  //   special_purpose → an SP bot's defaultConversationId points here
  //   remote_control  → it's in an RC bot's pool (telegram_chats row)
  // Both cases short-circuit the picker; the user can't double-link.
  if (conv.telegramLink) {
    return <AlreadyLinked link={conv.telegramLink} />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <CreateNewBotCard onClick={onCreateNew} />

        {specialPurpose.length > 0 && (
          <>
            <div className="mt-1 px-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              Or reassign an existing dedicated bot
            </div>
            {specialPurpose.map((bot) => (
              <BotPickerCard
                key={bot.id}
                bot={bot}
                onPick={() =>
                  bot.defaultConversationId
                    ? onPickAssigned(bot)
                    : onPickUnassigned(bot)
                }
              />
            ))}
          </>
        )}
      </div>

      <p className="px-1 text-[11px] text-muted-foreground leading-relaxed">
        Your Remote Control bot (if any) manages its own pool from inside
        Telegram via <span className="font-mono">/new</span>. To add a
        conversation there, ask the bot directly.
      </p>
    </div>
  )
}

// Clickable Card pattern for the picker rows. Card is a static
// primitive; making it a button via render-as is the shadcn idiom
// for an action-trigger card. Keeps focus-ring + keyboard handling.
function CreateNewBotCard({ onClick }: { onClick: () => void }) {
  return (
    <Card
      size="sm"
      className={cn(
        'cursor-pointer border-dashed transition-colors hover:bg-muted/40',
      )}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlusIcon className="size-4 text-muted-foreground" />
          Create new bot
        </CardTitle>
        <CardDescription>
          Make a dedicated bot for this conversation. Paste a token from{' '}
          <span className="font-mono">@BotFather</span>.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

function BotPickerCard({
  bot,
  onPick,
}: {
  bot: TelegramConnection
  onPick: () => void
}) {
  const assigned = !!bot.defaultConversationId
  const label = formatBotLabel(bot)
  return (
    <Card
      size="sm"
      className={cn('cursor-pointer transition-colors hover:bg-muted/40')}
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPick()
        }
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{label}</CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          {assigned ? (
            <Badge variant="outline">
              <TriangleAlertIcon data-icon="inline-start" />
              Reassigning will detach the current chat
            </Badge>
          ) : (
            <span>Unassigned — ready to link</span>
          )}
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

// Shown when the conversation is already reachable from a bot.
// Kind-aware copy: SP bots route every message to this conversation;
// RC bots manage a pool and need /switch to point messages here.
// Read-only — to relink, unlink from settings or send a different
// conversation through Send-to-Telegram.
function AlreadyLinked({
  link,
}: {
  link: NonNullable<ConversationSummary['telegramLink']>
}) {
  const label = formatBotLabel(link)
  const url = link.botUsername ? `https://t.me/${link.botUsername}` : null
  const isRemoteControl = link.kind === 'remote_control'
  const body = isRemoteControl
    ? `This conversation is in ${label}'s Remote Control pool. Open the bot and use /switch to point new messages here, or just /list to see all your conversations.`
    : `Type messages there to continue this conversation. Replies will stream back here and mirror to the Telegram chat.`
  return (
    <div className="flex flex-col gap-3">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Already linked to {label}
            {isRemoteControl && (
              <Badge variant="secondary">Remote Control</Badge>
            )}
          </CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
      </Card>
      {url && (
        <Button
          type="button"
          variant="default"
          render={
            <a href={url} target="_blank" rel="noreferrer">
              Open {label} on Telegram
            </a>
          }
        />
      )}
    </div>
  )
}
