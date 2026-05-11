import { ClockIcon, InboxIcon, StarIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { InboxCard } from '@/components/inbox/InboxCard'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { LinkButton } from '@/components/ui/link-button'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useInboxItems } from '@/modules/api/inbox.hooks'

type Filter = 'all' | 'unread' | 'starred'

export function Inbox() {
  const { data, isLoading } = useInboxItems()
  const items = data ?? []
  const [filter, setFilter] = useState<Filter>('unread')

  const filtered = useMemo(() => {
    if (filter === 'unread') return items.filter((i) => i.status === 'unread')
    if (filter === 'starred') return items.filter((i) => i.starred)
    return items
  }, [items, filter])

  const unreadCount = items.filter((i) => i.status === 'unread').length
  const starredCount = items.filter((i) => i.starred).length

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader maxWidth="max-w-3xl" className="justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="font-semibold text-base tracking-tight">Inbox</h1>
          <span className="font-mono text-muted-foreground text-xs">
            {items.length} item{items.length === 1 ? '' : 's'}
          </span>
        </div>
        <ToggleGroup
          value={[filter]}
          onValueChange={(v: string[]) => v[0] && setFilter(v[0] as Filter)}
          size="sm"
          variant="outline"
        >
          <ToggleGroupItem value="all" aria-label="All">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="unread" aria-label="Unread">
            Unread
            {unreadCount > 0 && (
              <span className="ml-1.5 rounded bg-primary/20 px-1 font-mono text-[10px] text-primary">
                {unreadCount}
              </span>
            )}
          </ToggleGroupItem>
          <ToggleGroupItem value="starred" aria-label="Starred">
            <StarIcon data-icon="inline-start" />
            {starredCount}
          </ToggleGroupItem>
        </ToggleGroup>
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-6 2xl:max-w-4xl">
          {isLoading ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : filtered.length === 0 ? (
            <EmptyInbox filter={filter} />
          ) : (
            filtered.map((item) => <InboxCard key={item.id} item={item} />)
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyInbox({ filter }: { filter: Filter }) {
  if (filter === 'unread') {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>You're all caught up</EmptyTitle>
          <EmptyDescription>
            When your scheduled tasks finish, their results land here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  if (filter === 'starred') {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <StarIcon />
          </EmptyMedia>
          <EmptyTitle>Nothing starred</EmptyTitle>
          <EmptyDescription>
            Star items you want to revisit later.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>Inbox is empty</EmptyTitle>
        <EmptyDescription>
          Herbie can run prompts on a schedule and drop results here. Set up
          your first scheduled task and check back tomorrow morning.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <LinkButton to="/tasks/new">
          <ClockIcon data-icon="inline-start" />
          Create your first task
        </LinkButton>
      </EmptyContent>
    </Empty>
  )
}
