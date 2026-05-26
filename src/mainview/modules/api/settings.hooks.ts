import type { InferRequestType, InferResponseType } from 'hono/client'
import { nanoid } from 'nanoid'
import { useCallback } from 'react'
import { createMutation, createQuery } from 'react-query-kit'
import type { AgentId } from '../data/herbie-data.types'
import { api } from './client'
import { parseResponse } from './parseResponse'
import { queryClient } from './queryClient'

const $get = api.settings.$get
const $patch = api.settings.$patch

export type SettingsResponse = InferResponseType<typeof $get>
type UpdateSettingsInput = InferRequestType<typeof $patch>['json']
type UpdateSettingsResponse = InferResponseType<typeof $patch>

export const useSettings = createQuery<SettingsResponse>({
  queryKey: ['settings'],
  fetcher: () => $get().then(parseResponse<SettingsResponse>),
})

export const useUpdateSettings = createMutation<
  UpdateSettingsResponse,
  UpdateSettingsInput
>({
  mutationFn: (json) =>
    $patch({ json }).then(parseResponse<UpdateSettingsResponse>),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: useSettings.getKey() })
    // /agents is derived from settings (custom agents merge into the
    // detection rows) and has its own 60s stale window. Invalidate it
    // here so the AgentPicker reflects custom-agent edits immediately.
    queryClient.invalidateQueries({ queryKey: ['agents'] })
  },
})

export function useDefaultAgent(): {
  defaultAgent: AgentId
  setDefaultAgent: (agent: AgentId) => void
} {
  const { data } = useSettings()
  const { mutate } = useUpdateSettings()
  const setDefaultAgent = useCallback(
    (agent: AgentId) => {
      mutate({ agents: { defaultAgent: agent } })
    },
    [mutate],
  )
  // No cast — if the API enum drifts from AgentId, TS catches it here.
  return {
    defaultAgent: data?.agents.defaultAgent ?? 'claude',
    setDefaultAgent,
  }
}

// Derived from the API response so server-schema drift surfaces here
// as a TS error rather than silently casting unknown values into a
// stale union.
export type ThemeMode = SettingsResponse['appearance']['theme']

// Default permission mode applied to NEW conversations. Existing
// conversations keep whatever they were created with — that value
// lives on the conversation row, not in settings.
export type DefaultPermissionMode =
  SettingsResponse['general']['defaultPermissionMode']

export function useDefaultPermissionMode(): {
  defaultPermissionMode: DefaultPermissionMode
  setDefaultPermissionMode: (mode: DefaultPermissionMode) => void
} {
  const { data } = useSettings()
  const { mutate } = useUpdateSettings()
  const setDefaultPermissionMode = useCallback(
    (mode: DefaultPermissionMode) => {
      mutate({ general: { defaultPermissionMode: mode } })
    },
    [mutate],
  )
  return {
    defaultPermissionMode:
      data?.general.defaultPermissionMode ?? 'auto-approve-reads',
    setDefaultPermissionMode,
  }
}

export function useTheme(): {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
} {
  const { data } = useSettings()
  const { mutate } = useUpdateSettings()
  const setTheme = useCallback(
    (theme: ThemeMode) => {
      mutate({ appearance: { theme } })
    },
    [mutate],
  )
  return {
    theme: data?.appearance.theme ?? 'system',
    setTheme,
  }
}

const RECENT_WORKSPACES_CAP = 10

// Workspaces aren't a DB entity — just paths in the settings KV. The
// composer reads the default + MRU and writes back through PATCH.
export function useWorkspaces(): {
  defaultPath: string | null
  recent: string[]
  isLoading: boolean
  addRecent: (path: string) => void
  setDefault: (path: string) => void
} {
  const { data, isLoading } = useSettings()
  const { mutate } = useUpdateSettings()
  const defaultPath = data?.composer.workspaces.default ?? null
  const recent = data?.composer.workspaces.recent ?? []

  const addRecent = useCallback(
    (path: string) => {
      // De-dupe + bump to head; cap to keep the dropdown scannable. The
      // server enforces no max — the cap is purely UX. Sparse patch:
      // only ship `recent` so a settings-still-loading race can't blank
      // out `default` with an empty string.
      const next = [path, ...recent.filter((p) => p !== path)].slice(
        0,
        RECENT_WORKSPACES_CAP,
      )
      mutate({ composer: { workspaces: { recent: next } } })
    },
    [mutate, recent],
  )

  const setDefault = useCallback(
    (path: string) => {
      mutate({ composer: { workspaces: { default: path } } })
    },
    [mutate],
  )

  return { defaultPath, recent, isLoading, addRecent, setDefault }
}

export type CustomAgent = SettingsResponse['agents']['customAgents'][number]
export type CustomAgentDraft = Omit<CustomAgent, 'createdAt'>

// Custom agents are stored under `agents.customAgents`. Each row is a
// user-named ACP command — the wire `id` is part of the draft (not
// generated server-side) because that id ends up persisted on chat /
// task / telegram rows; we want the user to choose it explicitly so
// it stays readable in the UI and matches whatever they call the
// agent in their head.
export function useCustomAgents(): {
  agents: CustomAgent[]
  isLoading: boolean
  add: (draft: CustomAgentDraft) => void
  update: (id: string, draft: CustomAgentDraft) => void
  remove: (id: string) => void
} {
  const { data, isLoading } = useSettings()
  const { mutate } = useUpdateSettings()
  const agents = data?.agents.customAgents ?? []

  const add = useCallback(
    (draft: CustomAgentDraft) => {
      const next = [...agents, { ...draft, createdAt: Date.now() }]
      mutate({ agents: { customAgents: next } })
    },
    [mutate, agents],
  )

  const update = useCallback(
    (id: string, draft: CustomAgentDraft) => {
      const next = agents.map((a) =>
        a.id === id ? { ...draft, createdAt: a.createdAt } : a,
      )
      mutate({ agents: { customAgents: next } })
    },
    [mutate, agents],
  )

  const remove = useCallback(
    (id: string) => {
      const next = agents.filter((a) => a.id !== id)
      // If the removed agent was the saved default, reset to the
      // SETTINGS_DEFAULTS choice so new chats / tasks don't 400 on an
      // unknown id. 'claude' is the server-side bootstrap default; if
      // it isn't installed the user can pick another from the toggle
      // group above. Folded into the same PATCH so both updates land
      // in a single transaction.
      const currentDefault = data?.agents.defaultAgent
      const agentsPatch =
        currentDefault === id
          ? { customAgents: next, defaultAgent: 'claude' }
          : { customAgents: next }
      mutate({ agents: agentsPatch })
    },
    [mutate, agents, data],
  )

  return { agents, isLoading, add, update, remove }
}

export type McpServer = SettingsResponse['mcp']['servers'][number]
// Distributive Omit so the discriminator survives across the union.
// `Omit<Union, K>` collapses to common-keys-only — this preserves both variants.
export type McpServerDraft = McpServer extends infer S
  ? S extends McpServer
    ? Omit<S, 'id'>
    : never
  : never

// MCP servers are stored once and applied to every agent session. Changes
// only flow into new conversations — acpx passes mcpServers at newSession
// time; running sessions keep their original list. The UI surfaces this.
export function useMcpRegistry(): {
  servers: McpServer[]
  isLoading: boolean
  add: (draft: McpServerDraft) => void
  update: (id: string, draft: McpServerDraft) => void
  remove: (id: string) => void
} {
  const { data, isLoading } = useSettings()
  const { mutate } = useUpdateSettings()
  const servers = data?.mcp.servers ?? []

  const add = useCallback(
    (draft: McpServerDraft) => {
      const next = [...servers, { ...draft, id: nanoid(8) } as McpServer]
      mutate({ mcp: { servers: next } })
    },
    [mutate, servers],
  )

  const update = useCallback(
    (id: string, draft: McpServerDraft) => {
      const next = servers.map((s) =>
        s.id === id ? ({ ...draft, id } as McpServer) : s,
      )
      mutate({ mcp: { servers: next } })
    },
    [mutate, servers],
  )

  const remove = useCallback(
    (id: string) => {
      const next = servers.filter((s) => s.id !== id)
      mutate({ mcp: { servers: next } })
    },
    [mutate, servers],
  )

  return { servers, isLoading, add, update, remove }
}
