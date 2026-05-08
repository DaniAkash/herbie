import { createFileRoute } from '@tanstack/react-router'
import { InboxItem } from '@/screens/inbox/InboxItem'

function InboxItemRoute() {
  const { id } = Route.useParams()
  return <InboxItem id={id} />
}

export const Route = createFileRoute('/inbox/$id')({
  component: InboxItemRoute,
})
