import type { InferResponseType } from 'hono/client'
import { useCallback, useMemo } from 'react'
import { createMutation, createQuery } from 'react-query-kit'
import type { AgentId } from '../data/herbie-data.types'
import { api } from './client'
import { toastApiError } from './errorToast'
import { parseResponse } from './parseResponse'
import { queryClient } from './queryClient'

const $skillsGet = api.skills.$get
const $skillsAdd = api.skills.$post
const $skillDelete = api.skills[':name'].$delete
const $linkAdd = api.skills[':name'].links.$post
const $linkDelete = api.skills[':name'].links[':agent'].$delete

export type SkillsState = InferResponseType<typeof $skillsGet>
export type Skill = SkillsState['skills'][number]
export type SkillLink = SkillsState['links'][number]
// SkillLink.agent is the Herbie-narrowed enum the route emits (claude /
// codex / gemini). Reusing the wire type avoids drift if we add a fourth.
export type SkillsAgentId = SkillLink['agent']

export const useSkillsState = createQuery<SkillsState>({
  queryKey: ['skills'],
  fetcher: () => $skillsGet().then(parseResponse<SkillsState>),
})

// Each mutation endpoint returns the full post-mutation snapshot
// (`{ skills, links, … }`) so we don't need a follow-up GET — just narrow
// the response and write it straight into the query cache. Toggling a chip
// goes from "click → mutation → invalidate → refetch → re-render" to
// "click → mutation → cache write → re-render", which is what makes the
// toggles feel instant.
type WithSnapshot = SkillsState & Record<string, unknown>

function applySnapshot(data: unknown) {
  if (!data || typeof data !== 'object') return
  const snap = data as Partial<WithSnapshot>
  if (Array.isArray(snap.skills) && Array.isArray(snap.links)) {
    queryClient.setQueryData(useSkillsState.getKey(), {
      skills: snap.skills,
      links: snap.links,
    })
  }
}

const useAddSkillMutation = createMutation<unknown, { source: string }>({
  mutationFn: ({ source }) =>
    $skillsAdd({ json: { source } }).then(parseResponse),
  onSuccess: applySnapshot,
  onError: toastApiError('Could not install skill'),
})

const useRemoveSkillMutation = createMutation<unknown, { name: string }>({
  mutationFn: ({ name }) =>
    $skillDelete({ param: { name } }).then(parseResponse),
  onSuccess: applySnapshot,
  onError: toastApiError('Could not remove skill'),
})

const useLinkSkillMutation = createMutation<
  unknown,
  { name: string; agent: SkillsAgentId }
>({
  mutationFn: ({ name, agent }) =>
    $linkAdd({ param: { name }, json: { agent } }).then(parseResponse),
  onSuccess: applySnapshot,
  onError: toastApiError('Could not install skill for this agent'),
})

const useUnlinkSkillMutation = createMutation<
  unknown,
  { name: string; agent: SkillsAgentId }
>({
  mutationFn: ({ name, agent }) =>
    $linkDelete({ param: { name, agent } }).then(parseResponse),
  onSuccess: applySnapshot,
  onError: toastApiError('Could not uninstall skill for this agent'),
})

export function useSkills(): {
  skills: Skill[]
  linksBySkill: Map<string, Set<SkillsAgentId>>
  isLoading: boolean
  add: (source: string) => Promise<void>
  remove: (name: string) => void
  link: (name: string, agent: SkillsAgentId) => void
  unlink: (name: string, agent: SkillsAgentId) => void
} {
  const { data, isLoading } = useSkillsState()
  const addM = useAddSkillMutation()
  const removeM = useRemoveSkillMutation()
  const linkM = useLinkSkillMutation()
  const unlinkM = useUnlinkSkillMutation()

  const skills = data?.skills ?? []
  // Memoise so the toggle component doesn't see a new Map identity on every
  // unrelated re-render.
  const linksBySkill = useMemo(() => {
    const m = new Map<string, Set<SkillsAgentId>>()
    for (const link of data?.links ?? []) {
      if (link.broken) continue
      const set = m.get(link.skillName) ?? new Set<SkillsAgentId>()
      set.add(link.agent)
      m.set(link.skillName, set)
    }
    return m
  }, [data?.links])

  return {
    skills,
    linksBySkill,
    isLoading,
    // `add` keeps the async signature — the install dialog awaits the
    // result before closing on success. Errors are surfaced by the
    // mutation's onError; the dialog catches the rethrow and stays open.
    add: useCallback(
      async (source: string) => {
        await addM.mutateAsync({ source })
      },
      [addM],
    ),
    // remove / link / unlink are fire-and-forget from the UI's perspective
    // — `mutate` (not `mutateAsync`) swallows rejections so they don't
    // surface as unhandled promise rejections from event handlers.
    // The onError handler still runs and shows the toast.
    remove: useCallback(
      (name: string) => {
        removeM.mutate({ name })
      },
      [removeM],
    ),
    link: useCallback(
      (name: string, agent: SkillsAgentId) => {
        linkM.mutate({ name, agent })
      },
      [linkM],
    ),
    unlink: useCallback(
      (name: string, agent: SkillsAgentId) => {
        unlinkM.mutate({ name, agent })
      },
      [unlinkM],
    ),
  }
}

// Helper for the UI: which Herbie agents support skills, and which of
// those are detected as installed. Empty `installedAgentIds` → render
// the chip disabled with a tooltip explaining it's not on this machine.
export const SKILLS_CAPABLE_AGENT_IDS = ['claude', 'codex', 'gemini'] as const

export function intersectInstalled(
  installedAgentIds: Iterable<AgentId>,
): SkillsAgentId[] {
  const installed = new Set(installedAgentIds)
  return SKILLS_CAPABLE_AGENT_IDS.filter((a) => installed.has(a))
}
