// TODO(deprecated): All real-backed domains live in react-query now.
// The only thing this provider still hands out is the mock `agents`
// overlay (display labels + blurbs) used by Settings. Once that lands
// on a real source, delete this file entirely.

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { AgentInfo, Workspace } from './herbie-data.types'
import type { HerbieDataValue } from './herbie-data-context.types'
import { seedAgents, seedWorkspaces } from './mockSeed'

const HerbieDataContext = createContext<HerbieDataValue | null>(null)

export function HerbieDataProvider({ children }: { children: ReactNode }) {
  const [agents] = useState<AgentInfo[]>(seedAgents)
  const [workspaces] = useState<Workspace[]>(seedWorkspaces)

  const value = useMemo<HerbieDataValue>(
    () => ({ agents, workspaces }),
    [agents, workspaces],
  )

  return (
    <HerbieDataContext.Provider value={value}>
      {children}
    </HerbieDataContext.Provider>
  )
}

export function useHerbieData() {
  const ctx = useContext(HerbieDataContext)
  if (!ctx)
    throw new Error('useHerbieData must be used inside HerbieDataProvider')
  return ctx
}
