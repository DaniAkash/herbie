import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeftIcon,
  CheckIcon,
  MessageSquareIcon,
  StarIcon,
  Trash2Icon,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import {
  TestError,
  TestErrorMessage,
  TestErrorStack,
} from '@/components/ai-elements/test-results'
import { PageFooter, PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useDeleteInboxItem,
  useInboxItems,
  useOpenInChat,
  useUpdateInboxItem,
} from '@/modules/api/inbox.hooks'
import { clockTime, relativeTime } from '@/modules/utils/relativeTime'

export function InboxItem({ id }: { id: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useInboxItems()
  const updateMutation = useUpdateInboxItem()
  const deleteMutation = useDeleteInboxItem()
  const openMutation = useOpenInChat()
  const item = data?.find((i) => i.id === id) ?? null

  // Auto-flip unread → read once per opened item. A `useRef` keeps
  // a set of ids we've already PATCHed this mount so that a slow
  // list refetch (the local cache may keep `status: 'unread'`
  // across renders until the invalidate lands) can't make us fire
  // the same PATCH twice. The mutation is idempotent server-side,
  // but duplicate writes are still wasted traffic.
  const itemId = item?.id
  const itemStatus = item?.status
  const markedReadRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!itemId) return
    if (itemStatus !== 'unread') return
    if (markedReadRef.current.has(itemId)) return
    markedReadRef.current.add(itemId)
    updateMutation.mutate({ id: itemId, status: 'read' })
  }, [itemId, itemStatus, updateMutation])

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-3 px-6 py-8">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground text-sm">Item not found.</p>
        <LinkButton to="/inbox" variant="outline" size="sm">
          Back to Inbox
        </LinkButton>
      </div>
    )
  }

  async function handleContinue() {
    if (!item) return
    const res = await openMutation.mutateAsync({ id: item.id })
    navigate({ to: '/chat/$id', params: { id: res.conversationId } })
  }

  function handleDelete() {
    if (!item) return
    deleteMutation.mutate(
      { id: item.id },
      { onSuccess: () => navigate({ to: '/inbox' }) },
    )
  }

  const hasError = !!item.errorMessage
  const title = item.taskName

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader maxWidth="max-w-3xl">
        <LinkButton to="/inbox" variant="ghost" size="sm">
          <ArrowLeftIcon data-icon="inline-start" />
          Inbox
        </LinkButton>
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-10 2xl:max-w-4xl">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                {item.taskName}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {item.agentId}
              </Badge>
              <span className="text-muted-foreground text-xs tabular-nums">
                {relativeTime(item.createdAt)} · {clockTime(item.createdAt)}
              </span>
            </div>
            <h1 className="font-semibold text-3xl tracking-tight">{title}</h1>
          </div>
          {hasError ? (
            <TestError>
              <TestErrorMessage>{item.errorMessage}</TestErrorMessage>
              {(item.errorCode || item.errorDetails) && (
                <TestErrorStack>
                  {item.errorCode && (
                    <span className="opacity-70">{item.errorCode}: </span>
                  )}
                  {item.errorDetails ?? ''}
                </TestErrorStack>
              )}
            </TestError>
          ) : (
            <article className="whitespace-pre-line rounded-lg border bg-card/60 p-6 text-[15px] leading-relaxed">
              {item.body}
            </article>
          )}
        </div>
      </div>
      <PageFooter maxWidth="max-w-3xl">
        <Button onClick={handleContinue} disabled={openMutation.isPending}>
          <MessageSquareIcon data-icon="inline-start" />
          Open in chat
        </Button>
        {item.status !== 'done' && (
          <Button
            variant="outline"
            onClick={() =>
              updateMutation.mutate({ id: item.id, status: 'done' })
            }
          >
            <CheckIcon data-icon="inline-start" />
            Mark done
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() =>
            updateMutation.mutate({ id: item.id, starred: !item.starred })
          }
        >
          <StarIcon
            data-icon="inline-start"
            className={cn(item.starred && 'fill-amber-400 stroke-amber-400')}
          />
          {item.starred ? 'Starred' : 'Star'}
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          onClick={handleDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon data-icon="inline-start" />
          Delete
        </Button>
      </PageFooter>
    </div>
  )
}
