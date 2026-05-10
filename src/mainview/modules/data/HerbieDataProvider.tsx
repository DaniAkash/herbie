// TODO(deprecated): Do NOT add anything new here. This provider is a leftover
// from the UI prototype phase, holding in-memory mock state for inbox + tasks
// — the only domains still without a real backend. As each gets a libsql
// table + react-query hook, peel it out and shrink this file until it can be
// deleted. New state belongs in react-query, not here.

import { nanoid } from 'nanoid'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { AgentInfo, InboxItem, Task, Workspace } from './herbie-data.types'
import type {
  CreateTaskInput,
  HerbieDataValue,
  UpdateTaskInput,
} from './herbie-data-context.types'
import {
  seedAgents,
  seedInboxItems,
  seedTasks,
  seedWorkspaces,
} from './mockSeed'

const HerbieDataContext = createContext<HerbieDataValue | null>(null)

export function HerbieDataProvider({ children }: { children: ReactNode }) {
  const [agents] = useState<AgentInfo[]>(seedAgents)
  const [workspaces] = useState<Workspace[]>(seedWorkspaces)
  const [tasks, setTasks] = useState<Task[]>(seedTasks)
  const [inboxItems, setInboxItems] = useState<InboxItem[]>(seedInboxItems)

  const createTask = useCallback((input: CreateTaskInput): Task => {
    const now = Date.now()
    const task: Task = {
      id: `task-${nanoid(8)}`,
      name: input.name,
      prompt: input.prompt,
      agent: input.agent,
      workspaceId: input.workspaceId,
      schedule: input.schedule,
      outputs: input.outputs,
      status: 'active',
      createdAt: now,
    }
    setTasks((prev) => [task, ...prev])
    return task
  }, [])

  const updateTask = useCallback((input: UpdateTaskInput) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === input.id ? { ...t, ...input } : t)),
    )
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

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
      tasks,
      inboxItems,
      createTask,
      updateTask,
      deleteTask,
      setInboxItemStatus,
      toggleInboxStar,
      deleteInboxItem,
    }),
    [
      agents,
      workspaces,
      tasks,
      inboxItems,
      createTask,
      updateTask,
      deleteTask,
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
