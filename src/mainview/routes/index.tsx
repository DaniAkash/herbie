import { createFileRoute } from '@tanstack/react-router'
import { Home } from '@/screens/home/Home'

export const Route = createFileRoute('/')({
  component: Home,
})
