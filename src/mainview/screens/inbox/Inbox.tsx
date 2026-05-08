import { ClockIcon, InboxIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { InboxCard } from '@/components/inbox/InboxCard'
import { LinkButton } from '@/components/ui/link-button'
import { cn } from '@/lib/utils'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'

type Filter = 'all' | 'unread' | 'starred'

export function Inbox() {
  const { inboxItems } = useHerbieData()
  const [filter, setFilter] = useState<Filter>('unread')

  const filtered = useMemo(() => {
    const sorted = [...inboxItems].sort((a, b) => b.createdAt - a.createdAt)
    if (filter === 'unread') return sorted.filter((i) => i.status === 'unread')
    if (filter === 'starred') return sorted.filter((i) => i.starred)
    return sorted
  }, [inboxItems, filter])

  const unreadCount = inboxItems.filter((i) => i.status === 'unread').length
  const starredCount = inboxItems.filter((i) => i.starred).length

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-border border-b bg-background/95 px-6 py-3 backdrop-blur">
        <h1 className="font-semibold text-base">Inbox</h1>
        <div className="flex items-center gap-1">
          <FilterChip
            label="all"
            active={filter === 'all'}
            count={inboxItems.length}
            onClick={() => setFilter('all')}
          />
          <FilterChip
            label="unread"
            active={filter === 'unread'}
            count={unreadCount}
            onClick={() => setFilter('unread')}
          />
          <FilterChip
            label="★"
            active={filter === 'starred'}
            count={starredCount}
            onClick={() => setFilter('starred')}
          />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-6">
          {filtered.length === 0 ? <EmptyInbox filter={filter} /> : null}
          {filtered.map((item) => (
            <InboxCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}

function FilterChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string
  active: boolean
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors',
        active
          ? 'bg-secondary text-secondary-foreground'
          : 'text-muted-foreground hover:bg-secondary/50',
      )}
    >
      <span>{label}</span>
      <span className="text-[10px] opacity-60">{count}</span>
    </button>
  )
}

function EmptyInbox({ filter }: { filter: Filter }) {
  if (filter === 'unread') {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <InboxIcon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-medium text-sm">No new items</p>
        <p className="max-w-sm text-muted-foreground text-xs">
          When your scheduled tasks finish, their results will land here.
        </p>
      </div>
    )
  }
  if (filter === 'starred') {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm">
        Nothing starred yet.
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <InboxIcon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium text-sm">Inbox is empty</p>
      <p className="max-w-md text-muted-foreground text-xs">
        Herbie can run prompts on a schedule and drop the results here. Set up
        your first scheduled task and check back tomorrow morning.
      </p>
      <LinkButton to="/tasks/new" size="sm" className="mt-2 gap-1.5">
        <ClockIcon className="h-3.5 w-3.5" />
        Create your first task
      </LinkButton>
    </div>
  )
}
