// TODO(deprecated): Do NOT add anything new here. This provider is a leftover
// from the UI prototype phase, holding in-memory mock state for domains that
// don't have a backend yet (conversations, messages, tasks, inbox). As each
// domain gets a real API + react-query hook, peel it out and shrink this file
// until it can be deleted. New state belongs in react-query, not here.

import { nanoid } from 'nanoid'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { pickResponse } from './cannedResponses'
import type {
  AgentId,
  AgentInfo,
  Conversation,
  InboxItem,
  Message,
  Task,
  Workspace,
} from './herbie-data.types'
import type {
  AppendMessageInput,
  CreateConversationInput,
  CreateTaskInput,
  HerbieDataValue,
  UpdateTaskInput,
} from './herbie-data-context.types'
import {
  seedAgents,
  seedConversations,
  seedInboxItems,
  seedMessages,
  seedTasks,
  seedWorkspaces,
} from './mockSeed'

const HerbieDataContext = createContext<HerbieDataValue | null>(null)

export function HerbieDataProvider({ children }: { children: ReactNode }) {
  const [agents] = useState<AgentInfo[]>(seedAgents)
  const [workspaces] = useState<Workspace[]>(seedWorkspaces)
  const [conversations, setConversations] =
    useState<Conversation[]>(seedConversations)
  const [messages, setMessages] = useState<Message[]>(seedMessages)
  const [tasks, setTasks] = useState<Task[]>(seedTasks)
  const [inboxItems, setInboxItems] = useState<InboxItem[]>(seedInboxItems)

  const createConversation = useCallback(
    (input: CreateConversationInput): Conversation => {
      const now = Date.now()
      const conv: Conversation = {
        id: input.id ?? `conv-${nanoid(8)}`,
        title: input.title?.trim() || 'New conversation',
        defaultAgent: input.defaultAgent,
        workspaceId: input.workspaceId,
        origin: input.origin ?? 'desktop',
        createdAt: now,
        updatedAt: now,
      }
      setConversations((prev) => [conv, ...prev])
      if (input.initialAssistantMessage) {
        const msg: Message = {
          id: `msg-${nanoid(8)}`,
          conversationId: conv.id,
          role: 'assistant',
          parts: [{ type: 'text', text: input.initialAssistantMessage.body }],
          agent: input.initialAssistantMessage.agent,
          fromTaskId: input.initialAssistantMessage.fromTaskId,
          createdAt: now,
        }
        setMessages((prev) => [...prev, msg])
      }
      return conv
    },
    [],
  )

  const setConversationAgent = useCallback((id: string, agent: AgentId) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, defaultAgent: agent, updatedAt: Date.now() } : c,
      ),
    )
  }, [])

  const setConversationWorkspace = useCallback(
    (id: string, workspaceId: string | undefined) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, workspaceId, updatedAt: Date.now() } : c,
        ),
      )
    },
    [],
  )

  const appendMessage = useCallback(
    ({ conversationId, role, text, agent }: AppendMessageInput): Message => {
      const now = Date.now()
      const msg: Message = {
        id: `msg-${nanoid(8)}`,
        conversationId,
        role,
        parts: [{ type: 'text', text }],
        agent,
        createdAt: now,
      }
      setMessages((prev) => [...prev, msg])
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, updatedAt: now } : c,
        ),
      )

      if (role === 'user') {
        const conv = conversations.find((c) => c.id === conversationId)
        const targetAgent = agent ?? conv?.defaultAgent ?? 'claude'
        const reply = pickResponse(targetAgent, text)
        setTimeout(() => {
          const replyMsg: Message = {
            id: `msg-${nanoid(8)}`,
            conversationId,
            role: 'assistant',
            parts: [{ type: 'text', text: reply }],
            agent: targetAgent,
            createdAt: Date.now(),
          }
          setMessages((prev) => [...prev, replyMsg])
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId ? { ...c, updatedAt: Date.now() } : c,
            ),
          )
        }, 600)
      }
      return msg
    },
    [conversations],
  )

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

  const continueInboxItemInChat = useCallback(
    (id: string): Conversation => {
      const item = inboxItems.find((i) => i.id === id)
      if (!item) throw new Error(`inbox item not found: ${id}`)
      if (item.spawnedConversationId) {
        const existing = conversations.find(
          (c) => c.id === item.spawnedConversationId,
        )
        if (existing) return existing
      }
      const conv = createConversation({
        title: item.title,
        defaultAgent: item.agent,
        workspaceId: item.workspaceId,
        initialAssistantMessage: {
          body: item.body,
          agent: item.agent,
          fromTaskId: item.taskId,
        },
      })
      setInboxItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, status: 'read', spawnedConversationId: conv.id }
            : i,
        ),
      )
      return conv
    },
    [inboxItems, conversations, createConversation],
  )

  const value = useMemo<HerbieDataValue>(
    () => ({
      agents,
      workspaces,
      conversations,
      messages,
      tasks,
      inboxItems,
      createConversation,
      setConversationAgent,
      setConversationWorkspace,
      appendMessage,
      createTask,
      updateTask,
      deleteTask,
      setInboxItemStatus,
      toggleInboxStar,
      deleteInboxItem,
      continueInboxItemInChat,
    }),
    [
      agents,
      workspaces,
      conversations,
      messages,
      tasks,
      inboxItems,
      createConversation,
      setConversationAgent,
      setConversationWorkspace,
      appendMessage,
      createTask,
      updateTask,
      deleteTask,
      setInboxItemStatus,
      toggleInboxStar,
      deleteInboxItem,
      continueInboxItemInChat,
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
