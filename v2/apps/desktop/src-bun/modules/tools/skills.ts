import { join } from 'node:path'
import { createLogger } from '@bun/lib/log'
import { type AgentId, createSkillsManager } from 'agent-skills-manager'

const log = createLogger('skills')

/**
 * Herbie's runtime ids are acpx's; the skills linker has its own.
 *
 * Only the overlap is listed. A runtime with no entry keeps its access row
 * and gets no link, which is the honest outcome rather than guessing where
 * it reads skills from.
 */
const LINKABLE: Record<string, AgentId> = {
  claude: 'claude-code',
  codex: 'codex',
  cursor: 'cursor',
  opencode: 'opencode',
  gemini: 'gemini-cli',
  droid: 'droid',
  openclaw: 'openclaw',
  copilot: 'github-copilot',
  iflow: 'iflow-cli',
  qwen: 'qwen-code',
}

/**
 * Where an agent's linked skills live: inside its own folder.
 *
 * The default destination is the runtime's own global skills directory,
 * shared by every session on the machine. Overriding it per agent is what
 * keeps one Herbie agent's skills from turning up in every editor window,
 * and is what the library documents the override for.
 */
function skillsDirFor(workspaceDir: string): string {
  return join(workspaceDir, '.herbie-skills')
}

/**
 * Links a skill into one agent's folder, or takes it out again.
 *
 * The bundle itself lives once in the shared workspace; this only points an
 * agent at it. A skill with no bundle yet cannot be linked, which is
 * reported rather than treated as a failure of the switch.
 */
export async function setSkillAccess(input: {
  runtimeId: string
  workspaceDir: string
  skillsWorkspace: string
  skillName: string
  enabled: boolean
}): Promise<{ linked: boolean; reason?: string }> {
  const agent = LINKABLE[input.runtimeId]
  if (!agent) {
    return { linked: false, reason: `no skills path for ${input.runtimeId}` }
  }

  const manager = createSkillsManager({ workspaceDir: input.skillsWorkspace })
  const agentSkillsDir = skillsDirFor(input.workspaceDir)

  try {
    if (input.enabled) {
      await manager.link({
        skillName: input.skillName,
        agent,
        agentSkillsDir,
      })
    } else {
      await manager.unlink({
        skillName: input.skillName,
        agent,
        agentSkillsDir,
      })
    }
    return { linked: true }
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'could not link'
    log.warn('skill access not written', {
      skill: input.skillName,
      agent,
      reason,
    })
    return { linked: false, reason }
  }
}
