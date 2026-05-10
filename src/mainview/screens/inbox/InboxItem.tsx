import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeftIcon,
  CheckIcon,
  MessageSquareIcon,
  StarIcon,
  Trash2Icon,
} from 'lucide-react'
import { useEffect } from 'react'
import { PageFooter, PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { cn } from '@/lib/utils'
import { useCreateConversation } from '@/modules/api/chat.hooks'
import { useHerbieData } from '@/modules/data/HerbieDataProvider'
import { clockTime, relativeTime } from '@/modules/utils/relativeTime'

export function InboxItem({ id }: { id: string }) {
  const navigate = useNavigate()
  const { inboxItems, setInboxItemStatus, toggleInboxStar, deleteInboxItem } =
    useHerbieData()
  const createConversation = useCreateConversation()
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

  async function handleContinue() {
    if (!item) return
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

  function handleDelete() {
    if (!item) return
    deleteInboxItem(item.id)
    navigate({ to: '/inbox' })
  }

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
                {item.agent}
              </Badge>
              <span className="text-muted-foreground text-xs tabular-nums">
                {relativeTime(item.createdAt)} · {clockTime(item.createdAt)}
              </span>
            </div>
            <h1 className="font-semibold text-3xl tracking-tight">
              {item.title}
            </h1>
          </div>
          <article className="whitespace-pre-line rounded-lg border bg-card/60 p-6 text-[15px] leading-relaxed">
            {item.body}
          </article>
        </div>
      </div>
      <PageFooter maxWidth="max-w-3xl">
        <Button onClick={handleContinue}>
          <MessageSquareIcon data-icon="inline-start" />
          Continue in chat
        </Button>
        {item.status !== 'done' && (
          <Button
            variant="outline"
            onClick={() => setInboxItemStatus(item.id, 'done')}
          >
            <CheckIcon data-icon="inline-start" />
            Mark done
          </Button>
        )}
        <Button variant="outline" onClick={() => toggleInboxStar(item.id)}>
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
