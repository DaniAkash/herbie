import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { TelegramBrandIcon } from '@/components/icons/TelegramIcon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ConversationSummary } from '@/modules/api/chat.hooks'
import { useWorkspaces } from '@/modules/api/settings.hooks'
import {
  type CreateLinkResponse,
  type TelegramConnection,
  useCreateTelegramConnection,
  useCreateTelegramLink,
  useReassignTelegramBot,
} from '@/modules/api/telegram.hooks'
import { CreateBotStep } from './SendToTelegramDialog.create'
import { LinkStep } from './SendToTelegramDialog.link'
import { PickBotStep } from './SendToTelegramDialog.pick'
import { ReassignConfirmStep } from './SendToTelegramDialog.reassign'

type Step =
  | { kind: 'pick' }
  | { kind: 'create' }
  | {
      kind: 'link'
      link: CreateLinkResponse
      connectionId: string
      via: 'new' | 'existing'
    }
  | { kind: 'reassign-confirm'; bot: TelegramConnection }

export function SendToTelegramDialog({
  conv,
  open,
  onOpenChange,
}: {
  conv: ConversationSummary
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [step, setStep] = useState<Step>({ kind: 'pick' })

  const createLink = useCreateTelegramLink()
  const createBot = useCreateTelegramConnection()
  const reassign = useReassignTelegramBot()
  // Used as a fallback when the source conversation has no workspace
  // set — the create-connection schema requires a non-empty path, so
  // '' from `conv.workspacePath ?? ''` previously failed validation
  // and 400'd. Fall back to the user's default workspace instead.
  const { defaultPath } = useWorkspaces()

  // Reset to the pick step on every open. No other lifecycle logic
  // here — completion is reported explicitly by each action's own
  // handler (handleReassign for reassign, LinkStep's onLinked for
  // both deep-link paths). The dialog deliberately doesn't watch the
  // conversations cache to infer "did the link finish" — that data-
  // shaped state is owned by whichever surface initiated the action.
  useEffect(() => {
    if (open) setStep({ kind: 'pick' })
  }, [open])

  function reportLinked(botLabel: string): void {
    toast.success('Linked!', {
      description: `"${conv.title}" is now reachable from @${botLabel}.`,
    })
    onOpenChange(false)
  }

  async function startLinkFlow(
    connection: TelegramConnection,
    via: 'new' | 'existing',
  ): Promise<void> {
    try {
      const link = await createLink.mutateAsync({
        connectionId: connection.id,
        conversationId: conv.id,
      })
      setStep({ kind: 'link', link, connectionId: connection.id, via })
    } catch {
      // toastApiError on the mutation surfaces the message; stay on
      // the current step so the user can pick a different bot.
    }
  }

  async function handleReassign(bot: TelegramConnection): Promise<void> {
    try {
      await reassign.mutateAsync({
        connectionId: bot.id,
        conversationId: conv.id,
      })
      reportLinked(bot.botUsername ?? bot.name)
    } catch {
      // toastApiError surfaces the failure; stay on the confirm step
    }
  }

  async function handleCreate(args: {
    name: string
    botToken: string
  }): Promise<void> {
    const workspacePath = conv.workspacePath ?? defaultPath
    if (!workspacePath) {
      toast.error('No workspace selected', {
        description:
          "This conversation has no workspace, and you haven't set a default. Pick one in Settings before linking.",
      })
      return
    }
    try {
      const bot = await createBot.mutateAsync({
        name: args.name,
        botToken: args.botToken,
        kind: 'special_purpose',
        agentId: conv.agentId,
        modelId: conv.modelId ?? null,
        workspacePath,
        reasoningEffort: conv.reasoningEffort ?? null,
      })
      await startLinkFlow(bot, 'new')
    } catch {
      // mutation surfaces the error
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TelegramBrandIcon className="size-5" />
            Send to Telegram
          </DialogTitle>
          <DialogDescription>
            Continue "{conv.title}" from your phone via Telegram.
          </DialogDescription>
        </DialogHeader>
        {renderStep({
          step,
          conv,
          isCreating: createBot.isPending || createLink.isPending,
          isReassigning: reassign.isPending,
          startLinkFlow,
          handleReassign,
          handleCreate,
          setStep,
          onOpenChange,
          reportLinked,
        })}
      </DialogContent>
    </Dialog>
  )
}

// Split out as a function so the JSX inside SendToTelegramDialog stays
// readable — the dialog itself is the state machine; the steps are
// presentational.
function renderStep({
  step,
  conv,
  isCreating,
  isReassigning,
  startLinkFlow,
  handleReassign,
  handleCreate,
  setStep,
  onOpenChange,
  reportLinked,
}: {
  step: Step
  conv: ConversationSummary
  isCreating: boolean
  isReassigning: boolean
  startLinkFlow: (
    bot: TelegramConnection,
    via: 'new' | 'existing',
  ) => Promise<void>
  handleReassign: (bot: TelegramConnection) => Promise<void>
  handleCreate: (args: { name: string; botToken: string }) => Promise<void>
  setStep: (next: Step) => void
  onOpenChange: (open: boolean) => void
  reportLinked: (botLabel: string) => void
}) {
  switch (step.kind) {
    case 'pick':
      return (
        <PickBotStep
          conv={conv}
          onPickUnassigned={(bot) => startLinkFlow(bot, 'existing')}
          onPickAssigned={(bot) => setStep({ kind: 'reassign-confirm', bot })}
          onCreateNew={() => setStep({ kind: 'create' })}
        />
      )
    case 'create':
      return (
        <CreateBotStep
          conv={conv}
          isSubmitting={isCreating}
          onBack={() => setStep({ kind: 'pick' })}
          onSubmit={handleCreate}
        />
      )
    case 'link':
      return (
        <LinkStep
          conversationId={conv.id}
          connectionId={step.connectionId}
          link={step.link}
          via={step.via}
          onLinked={() => reportLinked(step.link.botUsername ?? 'bot')}
          onCancel={() => onOpenChange(false)}
        />
      )
    case 'reassign-confirm':
      return (
        <ReassignConfirmStep
          conv={conv}
          bot={step.bot}
          isSubmitting={isReassigning}
          onBack={() => setStep({ kind: 'pick' })}
          onConfirm={() => handleReassign(step.bot)}
        />
      )
  }
}
