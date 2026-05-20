import { PlusIcon, TriangleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ConversationSummary } from '@/modules/api/chat.hooks'
import {
  type TelegramConnection,
  useTelegramConnections,
} from '@/modules/api/telegram.hooks'

// Step 1: choose how to send. Lists existing special-purpose bots
// (showing what they're currently assigned to, if anything) and a
// "Create new bot" option. Remote-control bots are intentionally
// omitted — Send-to-Telegram is for Special Purpose flows; users add
// conversations to their Remote Control bot from inside Telegram via
// /new, not from the desktop.
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

  const alreadyLinkedBot = specialPurpose.find(
    (b) => b.defaultConversationId === conv.id,
  )
  if (alreadyLinkedBot) {
    return <AlreadyLinked bot={alreadyLinkedBot} />
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
  const label = bot.botUsername ? `@${bot.botUsername}` : bot.name
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

// Shown when the conversation is already linked to a bot. Read-only;
// to relink, the user goes through "Send to Telegram" again from a
// different conversation that wants this bot, or unlinks the current
// one from settings.
function AlreadyLinked({ bot }: { bot: TelegramConnection }) {
  const label = bot.botUsername ? `@${bot.botUsername}` : bot.name
  const url = bot.botUsername ? `https://t.me/${bot.botUsername}` : null
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border bg-muted/40 px-3 py-3">
        <div className="font-medium text-sm">Already linked to {label}</div>
        <p className="mt-1 text-muted-foreground text-xs leading-snug">
          Type messages there to continue this conversation. Replies will stream
          back here and mirror to the Telegram chat.
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
