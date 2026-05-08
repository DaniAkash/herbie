import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeftIcon,
  CheckIcon,
  MessageSquareIcon,
  StarIcon,
  Trash2Icon,
} from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { cn } from '@/lib/utils'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import { clockTime, relativeTime } from '@/modules/utils/relativeTime'

export function InboxItem({ id }: { id: string }) {
  const navigate = useNavigate()
  const {
    inboxItems,
    setInboxItemStatus,
    toggleInboxStar,
    deleteInboxItem,
    continueInboxItemInChat,
  } = useHerbieData()
  const item = inboxItems.find((i) => i.id === id)

  useEffect(() => {
    if (item && item.status === 'unread') setInboxItemStatus(item.id, 'read')
  }, [item, setInboxItemStatus])

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

  function handleContinue() {
    if (!item) return
    const conv = continueInboxItemInChat(item.id)
    navigate({ to: '/c/$id', params: { id: conv.id } })
  }

  function handleDelete() {
    if (!item) return
    deleteInboxItem(item.id)
    navigate({ to: '/inbox' })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-border border-b bg-background/95 px-6 py-3 backdrop-blur">
        <LinkButton
          to="/inbox"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Inbox
        </LinkButton>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-8">
          <div>
            <h1 className="font-semibold text-2xl tracking-tight">
              {item.title}
            </h1>
            <p className="mt-1 text-muted-foreground text-xs">
              from task <span className="font-mono">{item.taskName}</span> ·
              agent <span className="font-mono">{item.agent}</span> ·{' '}
              {relativeTime(item.createdAt)} at {clockTime(item.createdAt)}
            </p>
          </div>
          <div className="whitespace-pre-line rounded-lg border border-border bg-card p-5 text-sm leading-relaxed">
            {item.body}
          </div>
        </div>
      </div>
      <footer className="flex items-center gap-2 border-border border-t bg-background/95 px-6 py-3 backdrop-blur">
        <Button onClick={handleContinue} className="gap-1.5">
          <MessageSquareIcon className="h-4 w-4" />
          Continue in chat
        </Button>
        {item.status !== 'done' && (
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => setInboxItemStatus(item.id, 'done')}
          >
            <CheckIcon className="h-4 w-4" />
            Mark done
          </Button>
        )}
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => toggleInboxStar(item.id)}
        >
          <StarIcon
            className={cn(
              'h-4 w-4',
              item.starred && 'fill-amber-400 text-amber-400',
            )}
          />
          {item.starred ? 'Starred' : 'Star'}
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          className="gap-1.5 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
        >
          <Trash2Icon className="h-4 w-4" />
          Delete
        </Button>
      </footer>
    </div>
  )
}
