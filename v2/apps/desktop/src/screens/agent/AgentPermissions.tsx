import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { SwitchField } from '@/components/form/SwitchField'
import { TextField } from '@/components/form/TextField'
import { PanelRow, PanelSection } from '@/components/shell/Rows'
import { Button } from '@/components/ui/button'
import {
  type Agent,
  useCreateRule,
  useDeleteRule,
  usePatchAgent,
  useRules,
} from '@/modules/api/agents.hooks'
import {
  useSetToolAccess,
  useToolAccess,
  useTools,
} from '@/modules/api/tools.hooks'

/**
 * What this agent may do alone, and what it may reach.
 *
 * Servers and skills are common. These switches are this agent's own, so two
 * agents reading the same library can see different sets.
 */
export function AgentPermissions({ agent }: { agent: Agent }) {
  const agentId = agent.id
  const tools = useTools()
  const access = useToolAccess({ variables: { agentId } })
  const patch = usePatchAgent()

  // What the sidecar could not write, kept per row. A switch that is on
  // while nothing was linked is the one state worth saying out loud: the
  // setting is real, the runtime just cannot be told about it this way.
  const [notes, setNotes] = useState<Record<string, string>>({})
  const setAccess = useSetToolAccess({
    onSuccess: (data, { kind, refId }) => {
      setNotes((old) => ({
        ...old,
        [`${kind}:${refId}`]: data?.note ?? '',
      }))
    },
  })

  const allowed = (kind: 'server' | 'skill', id: string) =>
    access.data?.access.find((a) => a.kind === kind && a.refId === id)
      ?.enabled ?? false

  return (
    <>
      <PanelSection label="When nobody is watching">
        <PanelRow
          k="Let it act on its own"
          v="Otherwise every step waits for you"
        >
          <SwitchField
            checked={agent.autonomy === 'auto'}
            onCheckedChange={(on) =>
              patch.mutate({ id: agentId, autonomy: on ? 'auto' : 'ask' })
            }
            ariaLabel="Let it act on its own"
          />
        </PanelRow>
        <PanelRow
          k="Ask on Telegram when unsure"
          v={
            agent.telegramBot
              ? 'Messages you from its own bot and waits'
              : 'Needs its bot connected first'
          }
        >
          <SwitchField
            checked={agent.askOnTelegram}
            disabled={!agent.telegramBot}
            onCheckedChange={(askOnTelegram) =>
              patch.mutate({ id: agentId, askOnTelegram })
            }
            ariaLabel="Ask on Telegram when unsure"
          />
        </PanelRow>
      </PanelSection>

      <Rules agentId={agentId} kind="ask" label="Always ask first" />
      <Rules agentId={agentId} kind="allow" label="Go ahead without asking" />

      {tools.data ? (
        <>
          <PanelSection label="Tools it can use">
            {tools.data.servers.map((server) => (
              <PanelRow
                key={server.id}
                k={<span className="font-mono text-[13px]">{server.name}</span>}
                v={serverCaption(notes[`server:${server.id}`], server.status)}
              >
                <SwitchField
                  checked={allowed('server', server.id)}
                  onCheckedChange={(enabled) =>
                    setAccess.mutate({
                      agentId,
                      kind: 'server',
                      refId: server.id,
                      enabled,
                    })
                  }
                  ariaLabel={server.name}
                />
              </PanelRow>
            ))}
            {tools.data.servers.length === 0 ? (
              <PanelRow k="No servers yet" v="Add one in Tools" />
            ) : null}
          </PanelSection>

          <PanelSection
            label="Skills it can use"
            note="Servers and skills are added once in Tools. These switches are this agent's alone."
          >
            {tools.data.skills.map((skill) => (
              <PanelRow
                key={skill.id}
                k={skill.name}
                v={problem(notes[`skill:${skill.id}`])}
              >
                <SwitchField
                  checked={allowed('skill', skill.id)}
                  onCheckedChange={(enabled) =>
                    setAccess.mutate({
                      agentId,
                      kind: 'skill',
                      refId: skill.id,
                      enabled,
                    })
                  }
                  ariaLabel={skill.name}
                />
              </PanelRow>
            ))}
            {tools.data.skills.length === 0 ? (
              <PanelRow k="No skills yet" v="Add one in Tools" />
            ) : null}
          </PanelSection>
        </>
      ) : null}
    </>
  )
}

/** Why a switch did not reach the runtime, when it did not. */
function problem(note: string | undefined): React.ReactNode {
  return note ? <span className="text-red">{note}</span> : undefined
}

/** The reason it could not be linked, else whether the server is running. */
function serverCaption(
  note: string | undefined,
  status: string,
): React.ReactNode {
  if (note) return problem(note)
  return status === 'failed' ? 'Not running' : undefined
}

/**
 * Standing instructions, in the words they were written in.
 *
 * Phrases rather than matchers because the agent reads them, not a rule
 * engine: a list of patterns would be precise about the wrong thing.
 *
 * A real form with a visible submit, not an input that commits on blur. A
 * chip editor whose only way to confirm is Enter leaves no way to find out
 * that Enter is what it wanted, and clicking anywhere else threw the phrase
 * away without saying so.
 */
function Rules({
  agentId,
  kind,
  label,
}: {
  agentId: string
  kind: 'ask' | 'allow'
  label: string
}) {
  const { data } = useRules({ variables: { agentId } })
  const create = useCreateRule()
  const remove = useDeleteRule()
  const [adding, setAdding] = useState(false)
  const [phrase, setPhrase] = useState('')

  const rules = data?.rules.filter((r) => r.kind === kind) ?? []
  const text = phrase.trim()

  return (
    <section className="mb-6">
      <div className="mb-2 font-medium text-[13px] text-ink-3">{label}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {rules.map((rule) => (
          <span
            key={rule.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-field py-[3px] pr-[5px] pl-2.5 font-medium text-[12.5px] shadow-hairline"
          >
            {rule.phrase}
            <button
              type="button"
              aria-label={`Remove ${rule.phrase}`}
              onClick={() => remove.mutate({ id: rule.id, agentId })}
              className="text-ink-3 hover:text-red"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {adding ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault()
              if (!text) return
              create.mutate({ agentId, kind, phrase: text })
              setPhrase('')
              setAdding(false)
            }}
          >
            <TextField
              autoFocus
              value={phrase}
              onChange={setPhrase}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setPhrase('')
                  setAdding(false)
                }
              }}
              placeholder={kind === 'ask' ? 'post' : 'read the feed'}
              aria-label={label}
              className="h-7 w-[150px]"
            />
            <Button
              size="xs"
              variant="secondary"
              type="submit"
              disabled={!text}
            >
              Save
            </Button>
            <Button
              size="xs"
              variant="ghost"
              type="button"
              onClick={() => {
                setPhrase('')
                setAdding(false)
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <Button size="xs" variant="ghost" onClick={() => setAdding(true)}>
            <Plus size={13} />
            Add
          </Button>
        )}
      </div>
    </section>
  )
}
