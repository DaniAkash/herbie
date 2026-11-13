import { useLocation, useNavigate, useParams } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'motion/react'
import { AgentFace } from '@/components/agent/AgentFace'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAgents } from '@/modules/api/agents.hooks'

const TABS = [
  { to: 'overview', label: 'Overview' },
  { to: 'routines', label: 'Routines' },
  { to: 'permissions', label: 'Permissions' },
] as const

/**
 * The panel's chrome, mounted once by the _panel layout route.
 *
 * It stays put while the tab below it changes, which is the whole point of
 * making the tabs nested routes: the face and the name do not rebuild every
 * time you move between them.
 *
 * Not beui's Drawer, despite that being the obvious name: Drawer is a modal
 * with a backdrop and a focus trap, and this is a column you read alongside
 * the conversation rather than instead of it.
 */
export function AgentPanel({ children }: { children: React.ReactNode }) {
  const { agentId } = useParams({ from: '/_shell/agents/$agentId' })
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data } = useAgents()
  const reduce = useReducedMotion()

  const agent = data?.agents.find((a) => a.id === agentId)
  if (!agent) return null

  const tab = TABS.find((t) => pathname.endsWith(t.to))?.to ?? 'overview'

  return (
    /*
     * Width as well as opacity, because the grid column is `auto`: animating
     * only the contents would leave the column at full width until the
     * element unmounted, and the conversation would snap sideways at the end
     * rather than growing into the space.
     *
     * The exit half of this only runs because the agent route keeps the panel
     * mounted through AnimatePresence while it plays.
     */
    <motion.aside
      initial={reduce ? false : { width: 0, opacity: 0 }}
      animate={{ width: 332, opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { width: 0, opacity: 0 }}
      transition={
        reduce
          ? { duration: 0 }
          : { type: 'spring', visualDuration: 0.28, bounce: 0.1 }
      }
      className="quiet-scroll min-h-0 overflow-y-auto overflow-x-hidden bg-canvas"
    >
      <div className="grid w-[332px] place-items-center gap-2 px-4 pt-[18px] pb-3.5 text-center">
        <AgentFace
          color={agent.color}
          size="lg"
          working={agent.state === 'working'}
          off={agent.state === 'off'}
        />
        <div>
          <div className="font-semibold text-[15px]">{agent.name}</div>
          <div className="text-[12.5px] text-ink-2">
            {agent.brief.split('.')[0]}
          </div>
        </div>
        <Tabs
          value={tab}
          onValueChange={(next) =>
            navigate({ to: `/agents/$agentId/${next}`, params: { agentId } })
          }
        >
          <TabsList variant="pill">
            {TABS.map((t) => (
              <TabsTrigger key={t.to} value={t.to}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="w-[332px] px-4 pt-0.5 pb-[22px]">{children}</div>
    </motion.aside>
  )
}
