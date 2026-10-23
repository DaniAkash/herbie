import { Button } from '@/components/atoms/Button'
import { EntityChip } from '@/components/atoms/EntityChip'
import { ValuePill } from '@/components/atoms/ValuePill'
import { AnimatedNumber } from '@/components/motion/animated-number'
import LoadingState from '@/components/primitives/LoadingState'
import { useAgents, useStatus } from '@/modules/api/status.hooks'
import { isDesktop } from '@/modules/host/host'
import { StatCard } from '@/screens/status/status-screen.components'
import { formatUptime } from '@/screens/status/status-screen.helpers'

export function StatusScreen() {
  const status = useStatus()
  const agents = useAgents()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-14">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-[28px] text-ink tracking-[-0.02em]">
            Herbie
          </h1>
          <p className="mt-1 text-[14px] text-ink-2">
            Running in {isDesktop() ? 'the desktop shell' : 'a browser'},
            talking to the sidecar over its own port.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void status.refetch()
            void agents.refetch()
          }}
          disabled={status.isFetching}
        >
          Refresh
        </Button>
      </header>

      {status.isPending ? (
        <LoadingState label="Reaching the sidecar" />
      ) : status.isError ? (
        <div className="rounded-card bg-red-tint p-5 text-[14px] text-red">
          <p className="font-medium">The sidecar is not answering.</p>
          <p className="mt-1 opacity-80">{status.error.message}</p>
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Process">
              <span className="tabular-nums">{status.data.pid}</span>
            </StatCard>
            <StatCard label="Uptime">
              {formatUptime(status.data.uptimeMs)}
            </StatCard>
            <StatCard label="Agents">
              <AnimatedNumber value={status.data.agentCount} />
            </StatCard>
          </section>

          <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card">
            <h2 className="font-medium text-[13px] text-ink-3 uppercase tracking-[0.08em]">
              Storage
            </h2>
            <p className="break-all font-mono text-[13px] text-ink-2">
              {status.data.databasePath}
            </p>
            <p className="text-[14px] text-ink-2">
              Schema at
              {status.data.migrations.map((name) => (
                <ValuePill key={name} tone="green">
                  {name}
                </ValuePill>
              ))}
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-medium text-[13px] text-ink-3 uppercase tracking-[0.08em]">
              Agents
            </h2>
            {agents.data && agents.data.agents.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {agents.data.agents.map((agent) => (
                  <EntityChip key={agent.id} name={agent.name} />
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-ink-3">
                No agents yet. The registry table exists and is empty, which is
                what the foundation is meant to prove.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  )
}
