import { Link, useNavigate } from '@tanstack/react-router'
import {
  CheckIcon,
  MessageSquareIcon,
  StarIcon,
  Trash2Icon,
} from 'lucide-react'
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
import { useCreateConversation } from '@/modules/api/chat.hooks'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import type { InboxItem } from '@/modules/data/herbie-data.types'
import { clockTime, relativeTime } from '@/modules/utils/relativeTime'

export function InboxCard({ item }: { item: InboxItem }) {
  const navigate = useNavigate()
  const { setInboxItemStatus, toggleInboxStar, deleteInboxItem } =
    useHerbieData()
  const createConversation = useCreateConversation()

  const isUnread = item.status === 'unread'
  const preview = item.body.split('\n').slice(0, 3).join('\n')

  async function handleContinue() {
    // Seeding the inbox body as a pre-loaded assistant message would require a
    // new server endpoint; for now just open a fresh conversation pre-tagged
    // with the inbox item's agent + workspace. Follow-up once inbox migrates.
    const conv = await createConversation.mutateAsync({
      agentId: item.agent,
      title: item.title,
      workspaceId: item.workspaceId ?? null,
    })
    setInboxItemStatus(item.id, 'read')
    navigate({ to: '/chat/$id', params: { id: conv.id } })
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
              {item.title}
            </Link>
          </CardTitle>
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {relativeTime(item.createdAt)} · {clockTime(item.createdAt)}
          </span>
        </div>
        <CardDescription className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="text-muted-foreground/70">from</span>
          <span>{item.taskName}</span>
          <span className="text-muted-foreground/40">/</span>
          <span>{item.agent}</span>
          {item.starred && (
            <StarIcon className="ml-1 size-3 fill-amber-400 stroke-amber-400" />
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <p className="line-clamp-3 whitespace-pre-line text-foreground/85 text-sm leading-relaxed">
          {preview}
        </p>
      </CardContent>
      <CardFooter className="gap-1 px-5 pt-3">
        <Button size="sm" onClick={handleContinue}>
          <MessageSquareIcon data-icon="inline-start" />
          Continue in chat
        </Button>
        {item.status !== 'done' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setInboxItemStatus(item.id, 'done')}
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
          onClick={() => toggleInboxStar(item.id)}
          aria-label={item.starred ? 'Unstar' : 'Star'}
        >
          <StarIcon
            className={cn(item.starred && 'fill-amber-400 stroke-amber-400')}
          />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => deleteInboxItem(item.id)}
          aria-label="Delete"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon />
        </Button>
      </CardFooter>
    </Card>
  )
}
