import { Link, useNavigate } from '@tanstack/react-router'
import {
  CheckIcon,
  MessageSquareIcon,
  StarIcon,
  Trash2Icon,
} from 'lucide-react'
import {
  TestError,
  TestErrorMessage,
  TestErrorStack,
} from '@/components/ai-elements/test-results'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  type InboxItemDto,
  useDeleteInboxItem,
  useOpenInChat,
  useUpdateInboxItem,
} from '@/modules/api/inbox.hooks'
import { clockTime, relativeTime } from '@/modules/utils/relativeTime'

export function InboxCard({ item }: { item: InboxItemDto }) {
  const navigate = useNavigate()
  const updateMutation = useUpdateInboxItem()
  const deleteMutation = useDeleteInboxItem()
  const openMutation = useOpenInChat()

  const isUnread = item.status === 'unread'
  const hasError = !!item.errorMessage
  const previewSource = hasError ? '' : item.body
  const preview = previewSource.split('\n').slice(0, 3).join('\n')
  const title = item.taskName
    ? `${item.taskName} · ${relativeTime(item.createdAt)}`
    : relativeTime(item.createdAt)

  async function handleContinue() {
    const res = await openMutation.mutateAsync({ id: item.id })
    navigate({ to: '/chat/$id', params: { id: res.conversationId } })
  }

  return (
    <Card
      className={cn(
        'group relative gap-3 overflow-hidden py-4 transition-all hover:bg-card/80',
        isUnread && 'ring-1 ring-primary/30',
      )}
    >
      {isUnread && (
        <span
          className="absolute top-4 left-0 h-8 w-[3px] rounded-r-full bg-primary"
          aria-hidden
        />
      )}
      <CardHeader className="gap-1 px-5">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="text-base">
            <Link
              to="/inbox/$id"
              params={{ id: item.id }}
              className="hover:underline"
            >
              {title}
            </Link>
          </CardTitle>
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {clockTime(item.createdAt)}
          </span>
        </div>
        <CardDescription className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="text-muted-foreground/70">from</span>
          <span>{item.taskName}</span>
          <span className="text-muted-foreground/40">/</span>
          <span>{item.agentId}</span>
          {item.starred && (
            <StarIcon className="ml-1 size-3 fill-amber-400 stroke-amber-400" />
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
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
          <p className="line-clamp-3 whitespace-pre-line text-foreground/85 text-sm leading-relaxed">
            {preview}
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-1 px-5 pt-3">
        <Button
          size="sm"
          onClick={handleContinue}
          disabled={openMutation.isPending}
        >
          <MessageSquareIcon data-icon="inline-start" />
          Open in chat
        </Button>
        {item.status !== 'done' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              updateMutation.mutate({ id: item.id, status: 'done' })
            }
          >
            <CheckIcon data-icon="inline-start" />
            Mark done
          </Button>
        )}
        <div className="flex-1" />
        {!isUnread && (
          <Badge
            variant="outline"
            className="mr-1 font-mono text-[9px] uppercase tracking-wider"
          >
            {item.status}
          </Badge>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() =>
            updateMutation.mutate({ id: item.id, starred: !item.starred })
          }
          aria-label={item.starred ? 'Unstar' : 'Star'}
        >
          <StarIcon
            className={cn(item.starred && 'fill-amber-400 stroke-amber-400')}
          />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => deleteMutation.mutate({ id: item.id })}
          aria-label="Delete"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon />
        </Button>
      </CardFooter>
    </Card>
  )
}
