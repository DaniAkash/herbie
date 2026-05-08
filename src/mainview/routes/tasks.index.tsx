import { createFileRoute } from '@tanstack/react-router'
import { Tasks } from '@/screens/tasks/Tasks'

export const Route = createFileRoute('/tasks/')({
  component: Tasks,
})
