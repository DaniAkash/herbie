import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Switch } from '@/components/motion/switch'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import { useToolAccess, useTools } from '@/modules/api/tools.hooks'

/**
 * What this agent may do alone, and what it may reach.
 *
 * Servers and skills are common. These switches are this agent's own, so two
 * agents reading the same library can see different sets.
 */
export function AgentPermissions({ agentId }: { agentId: string }) {
  const tools = useTools()
  const access = useToolAccess({ variables: { agentId } })

  const allowed = (kind: string, id: string) =>
    access.data?.access.find((a) => a.kind === kind && a.refId === id)
      ?.enabled ?? false

  return (
    <>
      <PanelSection label="When nobody is watching">
        <Toggle
          k="Let it act on its own"
          v="Otherwise every step waits for you"
          initial
        />
        <Toggle
          k="Ask on Telegram when unsure"
          v="Messages you from its own bot and waits"
          initial
        />
      </PanelSection>

      <Rules label="Always ask first" rules={['post', 'reply', 'follow']} />
      <Rules
        label="Go ahead without asking"
        rules={['read the feed', 'save a draft']}
      />

      {tools.data ? (
        <>
          <PanelSection label="Tools it can use">
            {tools.data.servers.map((server) => (
              <Toggle
                key={server.id}
                k={<span className="font-mono text-[13px]">{server.name}</span>}
                v={server.status === 'failed' ? 'Not running' : undefined}
                initial={allowed('server', server.id)}
              />
            ))}
          </PanelSection>

          <PanelSection
            label="Skills it can use"
            note="Servers and skills are added once in Tools. These switches are this agent's alone."
          >
            {tools.data.skills.map((skill) => (
              <Toggle
                key={skill.id}
                k={skill.name}
                initial={allowed('skill', skill.id)}
              />
            ))}
          </PanelSection>
        </>
      ) : null}
    </>
  )
}

function Toggle({
  k,
  v,
  initial,
}: {
  k: React.ReactNode
  v?: React.ReactNode
  initial: boolean
}) {
  const [on, setOn] = useState(initial)
  return (
    <PanelRow k={k} v={v}>
      <Switch
        checked={on}
        onCheckedChange={setOn}
        ariaLabel={typeof k === 'string' ? k : 'toggle'}
      />
    </PanelRow>
  )
}

function Rules({ label, rules }: { label: string; rules: string[] }) {
  return (
    <section className="mb-6">
      <div className="mb-2 font-medium text-[13px] text-ink-3">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {rules.map((rule) => (
          <span
            key={rule}
            className="inline-flex items-center gap-1.5 rounded-full bg-field py-[3px] pr-[5px] pl-2.5 font-medium text-[12.5px] shadow-hairline"
          >
            {rule}
            <X size={12} className="text-ink-3 hover:text-red" />
          </span>
        ))}
        <Button size="xs" variant="quiet">
          <Plus size={13} />
          Add
        </Button>
      </div>
    </section>
  )
}
