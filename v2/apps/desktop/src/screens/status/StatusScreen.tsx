import { useAgents, useStatus } from '@/modules/api/status.hooks'

export function StatusScreen() {
  const status = useStatus()
  const agents = useAgents()

  if (status.isPending) return <p>Connecting to the sidecar…</p>
  if (status.isError)
    return <p>Cannot reach the sidecar: {status.error.message}</p>

  return (
    <main>
      <h1>Herbie</h1>
      <dl>
        <dt>pid</dt>
        <dd>{status.data.pid}</dd>
        <dt>database</dt>
        <dd>{status.data.databasePath}</dd>
        <dt>migrations</dt>
        <dd>{status.data.migrations.join(', ')}</dd>
        <dt>agents</dt>
        <dd>{agents.data?.agents.length ?? status.data.agentCount}</dd>
      </dl>
    </main>
  )
}
