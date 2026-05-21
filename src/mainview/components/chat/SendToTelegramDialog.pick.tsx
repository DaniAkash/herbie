import { PlusIcon, TriangleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
        <button
          type="button"
          onClick={onCreateNew}
          className={cn(
            'flex items-start gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left transition-colors',
            'border-border hover:border-foreground/30 hover:bg-muted/40',
          )}
        >
          <PlusIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-sm">Create new bot</span>
            <span className="text-muted-foreground text-xs">
              Make a dedicated bot for this conversation. Paste a token from{' '}
              <span className="font-mono">@BotFather</span>.
            </span>
          </span>
        </button>

        {specialPurpose.length > 0 && (
          <>
            <div className="mt-1 px-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              Or reassign an existing dedicated bot
            </div>
            {specialPurpose.map((bot) => (
              <BotPickerRow
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

function BotPickerRow({
  bot,
  onPick,
}: {
  bot: TelegramConnection
  onPick: () => void
}) {
  const assigned = !!bot.defaultConversationId
  const label = formatBotLabel(bot)
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
        'border-border hover:border-foreground/30 hover:bg-muted/40',
      )}
    >
      <span className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-sm">{label}</span>
        {assigned ? (
          <span className="flex items-center gap-1 text-amber-700 text-xs dark:text-amber-400">
            <TriangleAlertIcon className="size-3" />
            Currently linked — reassigning will detach the current chat
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">
            Unassigned — ready to link
          </span>
        )}
      </span>
    </button>
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
      <div className="rounded-lg border bg-muted/40 px-3 py-3">
        <div className="font-medium text-sm">
          Already linked to {label}
          {isRemoteControl && (
            <span className="ml-2 font-normal text-[10px] text-muted-foreground uppercase tracking-wider">
              Remote Control
            </span>
          )}
        </div>
        <p className="mt-1 text-muted-foreground text-xs leading-snug">
          {body}
        </p>
      </div>
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
