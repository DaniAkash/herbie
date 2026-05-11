// TODO(deprecated): Do NOT add anything new here. This provider is a leftover
// from the UI prototype phase, holding in-memory mock state for inbox — the
// last domain still without a real backend. As inbox lands on libsql + a
// react-query hook (planned for the scheduled-tasks feature), peel it out
// and delete this file. New state belongs in react-query, not here.

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { AgentInfo, InboxItem, Workspace } from './herbie-data.types'
import type { HerbieDataValue } from './herbie-data-context.types'
import { seedAgents, seedInboxItems, seedWorkspaces } from './mockSeed'

const HerbieDataContext = createContext<HerbieDataValue | null>(null)

export function HerbieDataProvider({ children }: { children: ReactNode }) {
  const [agents] = useState<AgentInfo[]>(seedAgents)
  const [workspaces] = useState<Workspace[]>(seedWorkspaces)
  const [inboxItems, setInboxItems] = useState<InboxItem[]>(seedInboxItems)

  const setInboxItemStatus = useCallback(
    (id: string, status: InboxItem['status']) => {
      setInboxItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status } : i)),
      )
    },
    [],
  )

  const toggleInboxStar = useCallback((id: string) => {
    setInboxItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, starred: !i.starred } : i)),
    )
  }, [])

  const deleteInboxItem = useCallback((id: string) => {
    setInboxItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const value = useMemo<HerbieDataValue>(
    () => ({
      agents,
      workspaces,
      inboxItems,
      setInboxItemStatus,
      toggleInboxStar,
      deleteInboxItem,
    }),
    [
      agents,
      workspaces,
      inboxItems,
      setInboxItemStatus,
      toggleInboxStar,
      deleteInboxItem,
    ],
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
