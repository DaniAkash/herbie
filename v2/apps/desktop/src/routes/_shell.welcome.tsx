import { createFileRoute, Link } from '@tanstack/react-router'
import { AgentFace } from '@/components/agent/AgentFace'
import { Button } from '@/components/ui/button'
import { openOverlay } from '@/modules/navigation/overlay'

export const Route = createFileRoute('/_shell/welcome')({
  component: Welcome,
})

function Welcome() {
  return (
    <section className="grid content-center justify-items-center gap-3.5 px-5 py-10 text-center">
      <AgentFace color="ops" size="lg" />
      <h2 className="font-semibold text-[17px]">No agents yet</h2>
      <p className="max-w-[42ch] text-ink-2">
        An agent is an assistant you create. Give it a name, say what it should
        do, and it keeps working whether this window is open or not.
      </p>
      <Link to="." search={openOverlay('new')}>
        <Button variant="primary" size="md">
          Create your first agent
        </Button>
      </Link>
    </section>
  )
}
