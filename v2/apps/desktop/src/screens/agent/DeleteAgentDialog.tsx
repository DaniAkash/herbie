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
import { shortenHome } from '@/lib/paths'
import type { Agent } from '@/modules/api/agents.hooks'

/**
 * The confirm step before an agent is removed.
 *
 * A real dialog rather than window.confirm: the native one cannot say which
 * folder is about to go, and that is the part of this worth reading twice.
 */
export function DeleteAgentDialog({
  agent,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  agent: Agent
  open: boolean
  pending: boolean
  onOpenChange: (next: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {agent.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Its conversation, routines and rules go with it, and so does{' '}
            <span className="font-mono text-[12.5px]">
              {shortenHome(agent.workspaceDir)}
            </span>
            . This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={onConfirm}
            className="bg-red text-white hover:brightness-95"
          >
            {pending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
