import { createFileRoute } from '@tanstack/react-router'
import { TaskEditor } from '@/screens/tasks/TaskEditor'

function EditTaskRoute() {
  const { id } = Route.useParams()
  return <TaskEditor mode="edit" taskId={id} />
}

export const Route = createFileRoute('/tasks/$id')({
  component: EditTaskRoute,
})
