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

export interface DeleteTaskDialogProps {
  open: boolean
  taskName: string
  onCancel: () => void
  onConfirm: () => void
  isPending?: boolean
}

// Double-confirm before deleting a task. Run history and inbox cards
// cascade via the FKs, so the copy names what's about to disappear
// instead of letting the user discover it after the fact. Counts are
// intentionally not surfaced here — the cascade is documented in the
// description and pulling exact counts would mean two extra queries
// just to render this modal.
export function DeleteTaskDialog({
  open,
  taskName,
  onCancel,
  onConfirm,
  isPending,
}: DeleteTaskDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete task "{taskName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This will also delete all of this task's runs (scheduled + test) and
            any inbox cards it produced. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Deleting…' : 'Delete task'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
