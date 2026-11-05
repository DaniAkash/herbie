import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { REPORTING_TOOL_NAMES } from '@bun/modules/conversation/reporting'
import { ROUTINE_TOOL_NAMES } from '@bun/modules/routines/tools'

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

\`say\` is the default and most turns need nothing else; it is a plain chat message. Reach for a richer tool when the shape of what you have earns it: \`explain\` when you went and found out and the sources or follow-up questions are part of the answer, \`show_work\` once work is done, \`show_tasks\` for the state of several things, \`show_code\` when code is the answer, \`show_context\` when the sources are, \`show_insight\` for numbers, \`recommend\` for a decision you have a view on, and \`ask\` when you genuinely cannot continue without an answer.

Report as you go. A turn that takes minutes and ends in one perfect summary is worse than one that says what it found along the way, because until the first \`say\` lands the person is watching a spinner and cannot tell working from hung. Say something when you find an answer, change direction or hit a dead end.

Call \`set_activity\` every time you start a different piece of work, and before anything slow. It is not a message; it replaces the label beside the working indicator, and during a long turn it is the only thing the person has to look at.

Write the way you would speak to someone who does not want to read a transcript of a coding session. Say what happened and what it means for them. Do not narrate your reasoning, do not quote tool output at them, and do not explain which of these tools you are about to use.`
}

/**
 * Routine management, which the tool descriptions alone do not explain.
 *
 * They say what each tool does. What they cannot say is when to offer one
 * at all, which is a judgement about the conversation rather than about a
 * tool, and is the difference between an assistant that notices a standing
 * need and one that waits to be told twice.
 */
function routinesSection(): string {
  return [
    '## Work you do on your own',
    '',
    'Herbie keeps running when its window is closed, and it starts you up when one of your routines is due. A routine is a cadence and a prompt: when it fires you are asked that prompt with nobody watching, and whatever you report lands in this same conversation for the person to find later.',
    '',
    `You manage them yourself, by talking: ${ROUTINE_TOOL_NAMES.join(', ')}. There is no form for this anywhere in the app. The person can only switch a routine off or delete it from the panel, so everything else they want done, they will ask you for.`,
    '',
    'Offer one when you notice a standing need rather than a one-off question. "What changed in my repositories today" asked twice is a routine worth suggesting; asked once it is just a question. Suggest it, do not assume it, and never create one silently.',
    '',
    'Before changing anything, call `list_routines`, because you need the id and because the person usually means one they already have. Before deleting, use `ask`, and say which routine you mean and when it last ran so they are answering about the right one. Turning it off is usually what they actually want.',
  ].join('\n')
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
    routinesSection(),
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
 *
 * Only Herbie's own section is replaced. An agent can be pointed at a
 * directory the person already had, and a repository that already carries
 * instructions for its contributors is exactly the kind of directory that
 * gets pointed at. Rewriting the whole file would delete those instructions
 * on the first turn, and again on every brief change after it.
 */
export function writeBrief(workspaceDir: string, input: BriefInput): void {
  mkdirSync(workspaceDir, { recursive: true })
  const document = briefDocument(input)
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const path = join(workspaceDir, name)
    writeFileSync(path, merged(read(path), document), 'utf8')
  }
}

const OPEN = '<!-- herbie:begin -->'
const CLOSE = '<!-- herbie:end -->'

/** The file as it is, or empty when there is not one yet. */
function read(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

/**
 * The person's file with Herbie's section in it, put back where it was.
 *
 * A missing or unterminated marker is treated as no section at all and the
 * block is appended, because the alternative is guessing where someone's
 * edit ended and cutting their prose in half to find out.
 */
function merged(existing: string, document: string): string {
  const block = `${OPEN}\n${document}\n${CLOSE}\n`
  if (existing.trim().length === 0) return block

  const from = existing.indexOf(OPEN)
  const to = existing.indexOf(CLOSE)
  if (from === -1 || to === -1 || to < from) {
    return `${existing.replace(/\n*$/, '')}\n\n${block}`
  }
  return existing.slice(0, from) + block + existing.slice(to + CLOSE.length + 1)
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
 * The agent's process environment is in the material too. A session the
 * runtime persisted is only resumable from the configuration directory it
 * was recorded under, so moving that directory has to produce a new key:
 * resuming across the move fails inside the runtime, permanently, with
 * nothing this side can do about it afterwards.
 *
 * The transcript is unaffected, because it is ours. The person sees one
 * continuous thread while the agent starts again.
 */
export function briefVersion(
  input: BriefInput,
  env: Record<string, string> = {},
): string {
  const material = JSON.stringify({
    document: briefDocument(input),
    // Both tool sets, because acpx fixes the MCP configuration at
    // session/new and a session created without the routine tools cannot be
    // given them later.
    tools: [...REPORTING_TOOL_NAMES, ...ROUTINE_TOOL_NAMES],
    env,
  })
  return createHash('sha256').update(material).digest('hex').slice(0, 12)
}
