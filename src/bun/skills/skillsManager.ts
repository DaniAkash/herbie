import { homedir } from 'node:os'
import path from 'node:path'
import { createSkillsManager, type SkillsManager } from 'agent-skills-manager'

// Namespace the workspace to Herbie so a parallel skills.sh CLI install
// at the package default (~/.skills) doesn't collide. Compatible layout
// per agent-skills-manager docs.
export const SKILLS_WORKSPACE_DIR = path.join(homedir(), '.herbie', 'skills')

let _mgr: SkillsManager | null = null

export function getSkillsManager(): SkillsManager {
  if (!_mgr) _mgr = createSkillsManager({ workspaceDir: SKILLS_WORKSPACE_DIR })
  return _mgr
}
