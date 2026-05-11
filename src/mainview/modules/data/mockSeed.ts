import type { AgentInfo, Workspace } from './herbie-data.types'

export const seedAgents: AgentInfo[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    blurb: 'Best for code & refactors',
    status: 'ready',
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    blurb: 'Tight code edits, fast',
    status: 'ready',
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    blurb: 'Big context, exploration',
    status: 'signin-required',
  },
  {
    id: 'hermes',
    label: 'Hermes Agent',
    blurb: 'Long-running watchers',
    status: 'not-installed',
  },
]

export const seedWorkspaces: Workspace[] = [
  {
    id: 'browseros',
    name: 'browseros',
    path: '~/workbench/BrowserOS-ai/browseros',
    pinned: true,
  },
  {
    id: 'herbie',
    name: 'herbie',
    path: '~/workbench/DaniAkash/herbie',
    pinned: true,
  },
  {
    id: 'workstation',
    name: 'workstation',
    path: '~/workbench/DaniAkash/workstation',
  },
  {
    id: 'control-center',
    name: 'control-center',
    path: '~/Documents/Github/DaniAkash/control-center',
  },
]
