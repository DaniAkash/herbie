import { createFileRoute, redirect } from '@tanstack/react-router'

// Bare `/settings` lands on General. Using `beforeLoad` so the redirect
// fires before the layout mounts — no flash of an empty tab while the
// redirect resolves.
export const Route = createFileRoute('/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/general' })
  },
})
