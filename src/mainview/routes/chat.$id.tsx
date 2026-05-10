import { createFileRoute } from '@tanstack/react-router'
import { Chat } from '@/screens/chat/Chat'

function ChatRoute() {
  const { id } = Route.useParams()
  return <Chat conversationId={id} />
}

export const Route = createFileRoute('/chat/$id')({
  component: ChatRoute,
})
