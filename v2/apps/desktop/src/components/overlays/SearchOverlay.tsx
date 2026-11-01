import { Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AgentFace } from '@/components/agent/AgentFace'
import { useAgents } from '@/modules/api/agents.hooks'
import { closeOverlay } from '@/modules/navigation/overlay'

/**
 * A switcher, not a command palette.
 *
 * Served from the rail's cache, because the shell already loaded every agent.
 */
export function SearchOverlay() {
  const { data } = useAgents()
  const [q, setQ] = useState('')
  const field = useRef<HTMLInputElement>(null)

  // A switcher that opens without the caret in it is a switcher you have to
  // click before you can type.
  useEffect(() => {
    field.current?.focus()
  }, [])

  const agents = (data?.agents ?? []).filter((a) =>
    a.name.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div className="mt-[54px] w-[min(500px,100%)] overflow-hidden rounded-card bg-surface shadow-overlay">
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <Search size={17} className="text-ink-3" />
        <input
          ref={field}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Go to an agent"
          aria-label="Search"
          className="flex-1 border-none bg-transparent text-[15px] outline-none placeholder:text-ink-3"
        />
      </div>
      <div className="max-h-[300px] overflow-y-auto px-1.5 pb-1.5">
        {agents.length === 0 ? (
          <p className="px-2.5 py-3 text-[13.5px] text-ink-3">
            No agent by that name.
          </p>
        ) : (
          agents.map((agent) => (
            <Link
              key={agent.id}
              to="/agents/$agentId"
              params={{ agentId: agent.id }}
              search={closeOverlay}
              className="grid w-full grid-cols-[auto_1fr] items-center gap-2.5 rounded-control px-2.5 py-2 text-left hover:bg-hover"
            >
              <AgentFace
                color={agent.color}
                size="sm"
                off={agent.state === 'off'}
              />
              <span className="min-w-0">
                <span className="block font-medium text-[13.5px]">
                  {agent.name}
                </span>
                <span className="block truncate text-[12.5px] text-ink-2">
                  {agent.activity ?? agent.brief}
                </span>
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
