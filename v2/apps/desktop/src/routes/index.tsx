import { createFileRoute } from '@tanstack/react-router'
import { StatusScreen } from '@/screens/status/StatusScreen'

export const Route = createFileRoute('/')({
  component: StatusScreen,
})
