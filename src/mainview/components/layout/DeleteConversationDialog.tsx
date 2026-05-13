'use client'

import { useNavigate, useRouterState } from '@tanstack/react-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  type ConversationSummary,
  useDeleteConversation,
} from '@/modules/api/chat.hooks'

export function DeleteConversationDialog({
  open,
  onOpenChange,
  conv,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  conv: ConversationSummary
}) {
  const del = useDeleteConversation()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isCurrent = pathname === `/chat/${conv.id}`

  async function handleConfirm(): Promise<void> {
    // Navigate away first if the user is currently viewing this
    // conversation — otherwise the row disappears under them and the
    // route falls into a 404 state while react-query catches up.
    if (isCurrent) {
      await navigate({ to: '/chat/new' })
    }
    try {
      await del.mutateAsync({ id: conv.id })
      onOpenChange(false)
    } catch {
      // toastApiError surfaced the failure; keep the dialog open so
      // the user can retry or cancel.
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes <span className="font-medium">{conv.title}</span> from this
            machine permanently. Messages and the agent session record are
            wiped. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={del.isPending}
            onClick={() => {
              void handleConfirm()
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
