import {
  BanIcon,
  CheckIcon,
  EyeIcon,
  FileEditIcon,
  FolderInputIcon,
  SearchIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useResolvePermission } from '@/modules/api/chat.hooks'
import type {
  PermissionOutcome,
  PermissionPart,
  PermissionToolKind,
} from '@/screens/chat/chat.types'

// Decisions the card can produce. `cancel` is excluded — that only
// arrives from the server side (turn.cancel drains the registry).
type Decidable = Exclude<PermissionOutcome, 'cancel'>

interface PermissionApprovalCardProps {
  conversationId: string
  part: PermissionPart
}

export function PermissionApprovalCard({
  conversationId,
  part,
}: PermissionApprovalCardProps) {
  // Auto-resolved decisions (mode short-circuited; no card was ever
  // pending) render as a one-line breadcrumb so the transcript doesn't
  // get spammed with full cards under allow-all / read-only modes.
  if (part.state === 'resolved' && part.resolvedBy === 'auto') {
    return <AutoResolvedBreadcrumb part={part} />
  }
  if (part.state === 'resolved') {
    return <ResolvedCard part={part} />
  }
  return <PendingCard conversationId={conversationId} part={part} />
}

function PendingCard({
  conversationId,
  part,
}: {
  conversationId: string
  part: PermissionPart
}) {
  const resolve = useResolvePermission()
  // Disable all buttons after the first click — guards against
  // double-fire and against the user mashing two outcomes in quick
  // succession. The server-side registry resolves the first; the
  // second would 409 anyway, but disabling avoids the toast.
  const [submitting, setSubmitting] = useState(false)
  const onClick = (outcome: Decidable) => async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await resolve.mutateAsync({
        conversationId,
        requestId: part.id,
        outcome,
      })
    } catch {
      // mutation's onError surfaces a toast; clear the local guard
      // so the user can retry without reloading.
      setSubmitting(false)
    }
  }
  const KindIcon = kindIcon(part.toolKind)
  return (
    <div className="my-2 flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <div className="flex items-start gap-2">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-amber-700 text-sm dark:text-amber-400">
              Permission requested
            </span>
            {part.toolKind && (
              <Badge variant="outline" className="font-mono text-[10px]">
                <KindIcon data-icon="inline-start" />
                {part.toolKind}
              </Badge>
            )}
          </div>
          <p className="font-mono text-muted-foreground text-xs">
            Allow <span className="text-foreground">{part.toolName}</span>?
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onClick('reject_once')}
          disabled={submitting}
        >
          <XIcon data-icon="inline-start" />
          Deny
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onClick('reject_always')}
          disabled={submitting}
        >
          <BanIcon data-icon="inline-start" />
          Deny — don't ask again
        </Button>
        <Button size="sm" onClick={onClick('allow_once')} disabled={submitting}>
          <CheckIcon data-icon="inline-start" />
          Approve
        </Button>
        <Button
          size="sm"
          onClick={onClick('allow_always')}
          disabled={submitting}
        >
          <CheckIcon data-icon="inline-start" />
          Approve — don't ask again
        </Button>
      </div>
    </div>
  )
}

function ResolvedCard({ part }: { part: PermissionPart }) {
  const { tone, Icon, label } = describeOutcome(part.outcome, part.resolvedBy)
  return (
    <div
      className={cn(
        'my-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
        tone === 'allow' && 'border-border bg-muted/40 text-muted-foreground',
        tone === 'deny' &&
          'border-destructive/30 bg-destructive/5 text-destructive',
        tone === 'cancel' && 'border-border bg-muted/40 text-muted-foreground',
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="flex-1 leading-relaxed">
        {label} <span className="font-mono">{part.toolName}</span>
      </span>
    </div>
  )
}

function AutoResolvedBreadcrumb({ part }: { part: PermissionPart }) {
  const allowed = part.outcome?.startsWith('allow')
  return (
    <div className="my-1 flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
      {allowed ? (
        <CheckIcon className="size-3" />
      ) : (
        <XIcon className="size-3" />
      )}
      <span className="leading-relaxed">
        Auto-{allowed ? 'approved' : 'denied'}{' '}
        <span className="font-mono">{part.toolName}</span>
        {part.toolKind && (
          <span className="text-muted-foreground/60"> · {part.toolKind}</span>
        )}
      </span>
    </div>
  )
}

function describeOutcome(
  outcome: PermissionOutcome | undefined,
  resolvedBy: PermissionPart['resolvedBy'],
): {
  tone: 'allow' | 'deny' | 'cancel'
  Icon: typeof CheckIcon
  label: string
} {
  if (resolvedBy === 'cancel' || outcome === 'cancel') {
    return { tone: 'cancel', Icon: BanIcon, label: 'Cancelled' }
  }
  switch (outcome) {
    case 'allow_once':
      return { tone: 'allow', Icon: CheckIcon, label: 'Approved' }
    case 'allow_always':
      return {
        tone: 'allow',
        Icon: CheckIcon,
        label: 'Approved + remembered for this conversation —',
      }
    case 'reject_once':
      return { tone: 'deny', Icon: XIcon, label: 'Denied' }
    case 'reject_always':
      return {
        tone: 'deny',
        Icon: XIcon,
        label: 'Denied + remembered for this conversation —',
      }
    default:
      return { tone: 'cancel', Icon: BanIcon, label: 'Resolved' }
  }
}

function kindIcon(kind: PermissionToolKind | null): typeof CheckIcon {
  switch (kind) {
    case 'read':
      return EyeIcon
    case 'search':
    case 'fetch':
      return SearchIcon
    case 'edit':
      return FileEditIcon
    case 'execute':
      return TriangleAlertIcon
    case 'delete':
      return Trash2Icon
    case 'move':
      return FolderInputIcon
    default:
      return TriangleAlertIcon
  }
}
