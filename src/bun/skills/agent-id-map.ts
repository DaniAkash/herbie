import type { AgentId as SkillsAgentId } from 'agent-skills-manager'
import type { AgentId as HerbieAgentId } from '../../mainview/modules/data/herbie-data.types'

// Herbie uses a compact internal AgentId union. agent-skills-manager
// inherits skills.sh's larger catalog. Map at the boundary and refuse
// any agent that doesn't round-trip — `hermes` has no upstream entry
// today, so skills are silently unavailable for it.
const HERBIE_TO_SKILLS = {
  claude: 'claude-code',
  codex: 'codex',
  gemini: 'gemini-cli',
} as const satisfies Partial<Record<HerbieAgentId, SkillsAgentId>>

// Subset of HerbieAgentId that has a skills-catalog entry. Narrower than
// HerbieAgentId so the wire types in routes/skills.ts can reject 'hermes'
// at compile time.
export type SkillsCapableHerbieAgent = keyof typeof HERBIE_TO_SKILLS

export const SKILLS_CAPABLE_AGENTS = Object.keys(
  HERBIE_TO_SKILLS,
) as SkillsCapableHerbieAgent[]

export function toSkillsAgent(id: HerbieAgentId): SkillsAgentId | null {
  return HERBIE_TO_SKILLS[id as SkillsCapableHerbieAgent] ?? null
}

export function fromSkillsAgent(
  id: SkillsAgentId,
): SkillsCapableHerbieAgent | null {
  for (const [herbie, skills] of Object.entries(HERBIE_TO_SKILLS) as [
    SkillsCapableHerbieAgent,
    SkillsAgentId,
  ][]) {
    if (skills === id) return herbie
  }
  return null
}
