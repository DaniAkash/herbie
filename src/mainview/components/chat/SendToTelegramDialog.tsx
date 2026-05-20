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
import {
  type ConversationSummary,
  useConversations,
} from '@/modules/api/chat.hooks'
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
  | { kind: 'link'; link: CreateLinkResponse; via: 'new' | 'existing' }
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

  // Reset to step 1 every time the dialog opens — avoids leaking the
  // previous run's link / create-form state into a fresh attempt.
  useEffect(() => {
    if (open) setStep({ kind: 'pick' })
  }, [open])

  const createLink = useCreateTelegramLink()
  const createBot = useCreateTelegramConnection()
  const reassign = useReassignTelegramBot()
  const conversations = useConversations()

  // Success signal: when the source conversation's telegramLink shows
  // up in the unified /chat response, the link completed. Catches
  // both the deep-link handshake and the reassignment path.
  useEffect(() => {
    if (!open) return
    const fresh = conversations.data?.find((c) => c.id === conv.id)
    if (fresh?.telegramLink) {
      toast.success('Linked!', {
        description: `"${fresh.title}" is now reachable from @${
          fresh.telegramLink.botUsername ?? fresh.telegramLink.botName
        }.`,
      })
      onOpenChange(false)
    }
  }, [conversations.data, conv.id, open, onOpenChange])

  async function startLinkFlow(
    connectionId: string,
    via: 'new' | 'existing',
  ): Promise<void> {
    try {
      const link = await createLink.mutateAsync({
        connectionId,
        conversationId: conv.id,
      })
      setStep({ kind: 'link', link, via })
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
      // Dialog auto-closes via the telegramLink useEffect above when
      // the conversations cache refreshes.
    } catch {
      // toastApiError surfaces the failure
    }
  }

  async function handleCreate(args: {
    name: string
    botToken: string
  }): Promise<void> {
    try {
      const bot = await createBot.mutateAsync({
        name: args.name,
        botToken: args.botToken,
        kind: 'special_purpose',
        agentId: conv.agentId,
        modelId: conv.modelId ?? null,
        workspacePath: conv.workspacePath ?? '',
        reasoningEffort: conv.reasoningEffort ?? null,
      })
      await startLinkFlow(bot.id, 'new')
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
}: {
  step: Step
  conv: ConversationSummary
  isCreating: boolean
  isReassigning: boolean
  startLinkFlow: (id: string, via: 'new' | 'existing') => Promise<void>
  handleReassign: (bot: TelegramConnection) => Promise<void>
  handleCreate: (args: { name: string; botToken: string }) => Promise<void>
  setStep: (next: Step) => void
  onOpenChange: (open: boolean) => void
}) {
  switch (step.kind) {
    case 'pick':
      return (
        <PickBotStep
          conv={conv}
          onPickUnassigned={(bot) => startLinkFlow(bot.id, 'existing')}
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
          link={step.link}
          via={step.via}
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
