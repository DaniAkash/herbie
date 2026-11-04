import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPORTING_TOOL_NAMES } from '@bun/modules/conversation/reporting'

/**
 * The standing brief, delivered through three channels because one of them is
 * missing on half the runtimes.
 *
 * ```text
 * 1. tool descriptions      always reach the model        the contract itself
 * 2. AGENTS.md + CLAUDE.md  written into the agent's      the brief, the rules,
 *    in its workspace       own folder by Herbie          the reporting rule
 * 3. sessionOptions         claude yes, codex no          belt and braces
 *    .systemPrompt
 * ```
 *
 * Channel 2 exists because `codex` advertises
 * `sessionCapabilities.systemPrompt: false`, so there is no system prompt to
 * put anything in. Herbie owns the agent's folder, so writing both filenames
 * is ours to do: Claude Code reads `CLAUDE.md`, Codex reads `AGENTS.md`, and
 * an agent that reads neither still has channel 1.
 */

export interface BriefInput {
  readonly name: string
  /** The agent's standing brief, in the person's words. */
  readonly brief: string
  /** ask | auto. Whether it may act without checking first. */
  readonly autonomy: string
  readonly rules: readonly { kind: string; phrase: string }[]
}

/**
 * The part that is the same for every agent.
 *
 * Written as prose rather than a list of rules because it is read by a model
 * that reasons about it, and because the one thing it has to land is a
 * change of habit: the agent's own replies go nowhere.
 */
function reportingSection(name: string): string {
  return `## How you report

You are ${name}, a friendly assistant working on behalf of the person who created you. You are not a coding agent talking to a developer, even though a coding agent is what you are built on.

Everything the person sees, they see because you called one of these tools: ${REPORTING_TOOL_NAMES.join(', ')}. Your ordinary replies are not shown to them. If you finish a turn without calling any of them, the person is left looking at silence, so never end a turn without reporting.

\`say\` is the default and most turns need nothing else. Reach for a richer tool when the shape of what you have earns it: \`show_work\` once work is done, \`show_tasks\` for the state of several things, \`show_code\` when code is the answer, \`show_context\` when the sources are, \`show_insight\` for numbers, \`recommend\` for a decision you have a view on, and \`ask\` when you genuinely cannot continue without an answer.

Call \`set_activity\` as you move between pieces of work. It is not a message; it replaces the label beside the working indicator, so the person watching knows where you are.

Write the way you would speak to someone who does not want to read a transcript of a coding session. Say what happened and what it means for them. Do not narrate your reasoning, do not quote tool output at them, and do not explain which of these tools you are about to use.`
}

function rulesSection(input: BriefInput): string {
  const ask = input.rules.filter((rule) => rule.kind === 'ask')
  const allow = input.rules.filter((rule) => rule.kind === 'allow')
  if (ask.length === 0 && allow.length === 0) return ''

  const lines = ['## Standing rules', '']
  if (allow.length > 0) {
    lines.push('Go ahead without checking first:')
    for (const rule of allow) lines.push(`- ${rule.phrase}`)
    lines.push('')
  }
  if (ask.length > 0) {
    lines.push('Ask before you do any of these, with the `ask` tool:')
    for (const rule of ask) lines.push(`- ${rule.phrase}`)
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

function autonomySection(input: BriefInput): string {
  return input.autonomy === 'auto'
    ? '## Working alone\n\nYou may act without waiting for the person, within the standing rules above. When something is irreversible or outside what they asked for, use `ask` rather than deciding for them.'
    : '## Working alone\n\nYou are not yet trusted to act unsupervised. Read and investigate freely, but use `ask` before anything that changes something outside your own workspace.'
}

/** The whole document, which is what both filenames get. */
export function briefDocument(input: BriefInput): string {
  const sections = [
    `# ${input.name}`,
    reportingSection(input.name),
    input.brief.trim() ? `## What you are for\n\n${input.brief.trim()}` : '',
    rulesSection(input),
    autonomySection(input),
  ]
  return `${sections.filter(Boolean).join('\n\n')}\n`
}

/**
 * The same document, as a system prompt for the runtimes that take one.
 *
 * Deliberately the same text rather than a second wording. Two versions of
 * the contract would drift, and the one that drifted would be the one only
 * half the runtimes ever read, which is the worst place for a difference to
 * hide.
 */
export function systemPrompt(input: BriefInput): string {
  return briefDocument(input)
}

/**
 * Writes the brief into the agent's own folder, under both filenames.
 *
 * Both rather than one, because which name is read is a property of the
 * runtime and an agent can be moved between runtimes after it was created.
 * Overwritten every time rather than merged: this file is Herbie's output,
 * not a document the person edits.
 */
export function writeBrief(workspaceDir: string, input: BriefInput): void {
  mkdirSync(workspaceDir, { recursive: true })
  const document = briefDocument(input)
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    writeFileSync(join(workspaceDir, name), document, 'utf8')
  }
}

/**
 * A short hash of everything acpx freezes when a session is created.
 *
 * Both `sessionOptions.systemPrompt` and `mcpServers` are fixed at
 * `session/new` and acpx refuses to change either while the session is live,
 * so there is no edit path, only a new session. Carrying this in the session
 * key is what makes a brief edit take effect: the key changes, a fresh
 * session is created with the new prompt, and the old record stays on disk.
 *
 * The transcript is unaffected, because it is ours. The person sees one
 * continuous thread while the agent starts again.
 */
export function briefVersion(input: BriefInput): string {
  const material = JSON.stringify({
    document: briefDocument(input),
    tools: REPORTING_TOOL_NAMES,
  })
  return createHash('sha256').update(material).digest('hex').slice(0, 12)
}
