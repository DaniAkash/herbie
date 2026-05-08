import { Link, useNavigate } from '@tanstack/react-router'
import {
  CheckIcon,
  MessageSquareIcon,
  StarIcon,
  Trash2Icon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import type { InboxItem } from '@/modules/data/herbie-data.types'
import { clockTime, relativeTime } from '@/modules/utils/relativeTime'

export function InboxCard({ item }: { item: InboxItem }) {
  const navigate = useNavigate()
  const {
    setInboxItemStatus,
    toggleInboxStar,
    deleteInboxItem,
    continueInboxItemInChat,
  } = useHerbieData()

  const isUnread = item.status === 'unread'
  const preview = item.body.split('\n').slice(0, 4).join('\n')

  function handleContinue() {
    const conv = continueInboxItemInChat(item.id)
    navigate({ to: '/c/$id', params: { id: conv.id } })
  }

  return (
    <Card
      className={cn(
        'group p-4 transition-colors hover:border-border/80',
        isUnread && 'border-l-4 border-l-primary',
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        {isUnread && (
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
        )}
        <Link
          to="/inbox/$id"
          params={{ id: item.id }}
          className="font-semibold text-base hover:underline"
        >
          {item.title}
        </Link>
        <div className="ml-auto flex items-center gap-2 text-muted-foreground text-xs">
          <span>{relativeTime(item.createdAt)}</span>
          <span>·</span>
          <span>{clockTime(item.createdAt)}</span>
        </div>
      </div>
      <div className="mb-3 text-muted-foreground text-xs">
        From task <span className="font-mono">{item.taskName}</span> · agent{' '}
        <span className="font-mono">{item.agent}</span>
      </div>
      <div className="mb-4 line-clamp-3 whitespace-pre-line text-foreground/90 text-sm leading-relaxed">
        {preview}
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" className="h-8 gap-1.5" onClick={handleContinue}>
          <MessageSquareIcon className="h-3.5 w-3.5" />
          Continue in chat
        </Button>
        {item.status !== 'done' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5"
            onClick={() => setInboxItemStatus(item.id, 'done')}
          >
            <CheckIcon className="h-3.5 w-3.5" />
            Mark done
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => toggleInboxStar(item.id)}
          aria-label={item.starred ? 'Unstar' : 'Star'}
        >
          <StarIcon
            className={cn(
              'h-3.5 w-3.5',
              item.starred && 'fill-amber-400 text-amber-400',
            )}
          />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => deleteInboxItem(item.id)}
          aria-label="Delete"
        >
          <Trash2Icon className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  )
}
