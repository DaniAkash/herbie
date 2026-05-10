import { createFileRoute } from '@tanstack/react-router'
import { Chat } from '@/screens/chat/Chat'

export const Route = createFileRoute('/chat/new')({
  component: () => <Chat conversationId="new" />,
})
