import { join } from 'node:path'
import { stateDir } from '@bun/lib/env'
import { createLogger } from '@bun/lib/log'
import {
  type BriefInput,
  briefVersion,
  systemPrompt,
  writeBrief,
} from '@bun/modules/conversation/brief'
import { cancelAll, hold, release } from '@bun/modules/conversation/pending'
import { escalate } from '@bun/modules/conversation/permissions'
import { isBlock, writeRecord } from '@bun/modules/conversation/records'
import { reportingTools } from '@bun/modules/conversation/reporting'
import { runtimeHome } from '@bun/modules/conversation/runtime-home'
import {
  openTranscript,
  type Transcript,
} from '@bun/modules/conversation/transcript'
import type { Db } from '@bun/modules/db/db'
import { agentRules, agents } from '@bun/modules/db/schema/schema'
import { routineTools } from '@bun/modules/routines/tools'
import type { DraftRecord, TranscriptRecord } from '@bun/shared/transcript'
import { type AcpxProvider, createAcpxProvider } from 'acpx-ai-provider'
import { asc, eq, sql } from 'drizzle-orm'

const log = createLogger('conversation')

/**
 * One agent, one acpx session, one provider.
 *
 * A provider per agent rather than one runtime serving all of them, because
 * everything that differs per agent, `cwd`, `hostTools` and `sessionKey`, is
 * a provider-level setting and the tool server is bound before `session/new`.
 * The provider must also build its own runtime: a pre-built one never
 * receives the per-session resolver, so the agent would never discover the
 * reporting tools at all.
 */

export type AgentRow = typeof agents.$inferSelect

export interface TurnState {
  readonly id: string
  readonly controller: AbortController
  readonly startedAt: number
  phase: 'thinking' | 'working'
  /** Tool calls so far, which is the only thing moving during a long silence. */
  steps: number
  /** When the last block the person can see was written. */
  lastBlockAt: number
  /** When progress was last pushed, so a busy turn does not flood watchers. */
  lastPushAt: number
  /** What the live indicator says. Set by the agent, or inferred from a call. */
  activity: string
  /** Blocks reported so far, which is what the no-report fallback reads. */
  reported: number
  /** The agent's own last words, promoted to a block if nothing was reported. */
  text: string
}

export interface AgentSession {
  readonly agentId: string
  readonly workspaceDir: string
  readonly version: string
  readonly provider: AcpxProvider
  readonly transcript: Transcript
  /** The turn in flight, or null. The host tools read it when they fire. */
  current: TurnState | null
}

const sessions = new Map<string, AgentSession>()

function briefInput(db: Db, agent: AgentRow): BriefInput {
  const rules = db
    .select()
    .from(agentRules)
    .where(eq(agentRules.agentId, agent.id))
    .orderBy(asc(agentRules.createdAt))
    .all()
  return {
    name: agent.name,
    brief: agent.brief,
    autonomy: agent.autonomy,
    rules: rules.map((rule) => ({ kind: rule.kind, phrase: rule.phrase })),
  }
}

/** Where a block lands, which is wherever the turn in flight is. */
function target(session: AgentSession) {
  return {
    agentId: session.agentId,
    transcript: session.transcript,
    turn: session.current?.id ?? 't_detached',
  }
}

/** Writes a block and counts it against the turn, for the fallback. */
export function write(
  db: Db,
  session: AgentSession,
  draft: DraftRecord,
): TranscriptRecord {
  const record = writeRecord(db, target(session), draft)
  if (session.current && isBlock(draft.kind)) {
    session.current.reported += 1
    session.current.lastBlockAt = Date.now()
  }
  return record
}

/**
 * The session for an agent, built if it is absent or if its brief moved.
 *
 * The version covers everything acpx freezes at `session/new`: the brief, the
 * rules, the autonomy and the tool set. When it changes the old session is
 * closed and a new key used, because neither the system prompt nor the MCP
 * configuration can be edited on a session that is already live. The thread
 * is untouched by that, because it is ours: the person keeps one continuous
 * conversation while the agent starts again.
 */
export function sessionFor(db: Db, agent: AgentRow): AgentSession {
  const input = briefInput(db, agent)
  const home = runtimeHome(agent.acpAgent, agent.workspaceDir)
  const version = sessionVersion(input, home.env, agent.sessionGeneration)
  const existing = sessions.get(agent.id)
  if (existing && existing.version === version) return existing

  if (existing) {
    log.info('brief changed, starting a new session', {
      agent: agent.id,
      from: existing.version,
      to: version,
    })
    void existing.provider.close('brief changed')
    sessions.delete(agent.id)
  }

  // Written before the provider is built, so the agent finds it in its own
  // folder the moment the session starts rather than one turn later.
  writeBrief(agent.workspaceDir, input)

  // Declared before the provider because the provider's callbacks close over
  // it, and assigned after because the provider is one of its fields. They
  // only read it when the agent calls a tool, which is long after both exist.
  let session!: AgentSession

  const provider = createAcpxProvider({
    agent: agent.acpAgent,
    cwd: agent.workspaceDir,
    // Its own config directory, so a new assistant starts as itself rather
    // than as a copy of whatever is installed on this machine. It is in the
    // version above, because a persisted session cannot be resumed from a
    // different home than the one that recorded it.
    agentProcessEnv: home.env,
    sessionKey: `${agent.id}:${version}`,
    sessionMode: 'persistent',
    stateDir: join(stateDir(), 'acpx'),
    // Reads flow either way. An agent trusted to work alone gets the rest
    // too, and governs itself through the `ask` tool and its own rules.
    permissionMode: agent.autonomy === 'auto' ? 'approve-all' : 'approve-reads',
    onPermissionRequest:
      agent.autonomy === 'auto'
        ? undefined
        : (request, ctx) =>
            escalate(
              agent.id,
              (draft) => write(db, session, draft),
              request,
              ctx.signal,
            ),
    sessionOptions: {
      // Only some runtimes take one: codex advertises systemPrompt false and
      // ignores it, which is why the same text is also on disk.
      systemPrompt: systemPrompt(input),
      ...(agent.model ? { model: agent.model } : {}),
    },
    hostTools: {
      serverName: 'herbie',
      // Two sets on one server. The reporting tools decide what the person
      // sees; the routine tools decide what the agent does when nobody is
      // watching. Both are fixed at session/new, which is why the version
      // above hashes their names.
      tools: {
        ...reportingTools({
          append: (draft) => write(db, session, draft),
          awaitAnswers: (recordId, signal) =>
            awaitAnswers(session.agentId, recordId, signal),
          setActivity: (text) => setActivity(db, session, text),
        }),
        ...routineTools({ db, agentId: agent.id }),
      },
    },
  })

  session = {
    agentId: agent.id,
    workspaceDir: agent.workspaceDir,
    version,
    transcript: openTranscript(agent.workspaceDir),
    current: null,
    provider,
  }

  sessions.set(agent.id, session)
  return session
}

/**
 * Holds the `ask` tool open until the person replies, or the turn ends.
 *
 * Resolving empty on abort rather than rejecting, so a cancelled turn hands
 * the agent "no answer" and lets it wind down, instead of throwing inside its
 * own tool call.
 */
function awaitAnswers(
  agentId: string,
  recordId: string,
  signal: AbortSignal,
): Promise<Record<string, readonly number[]>> {
  return new Promise((resolve) => {
    hold<Record<string, readonly number[]>>(agentId, recordId, {
      resolve,
      onCancel: () => ({}),
    })
    signal.addEventListener(
      'abort',
      () => {
        release(agentId, recordId)
        resolve({})
      },
      { once: true },
    )
  })
}

/**
 * What the agent says it is doing, published rather than only remembered.
 *
 * This is the only thing the person has to look at during a long turn, so it
 * has to reach three places: the turn state that the indicator reads, the
 * agent row that the rail reads, and the thread as a record so a watcher that
 * connects mid-turn sees the current label rather than the one it started on.
 */
function setActivity(db: Db, session: AgentSession, text: string): void {
  const current = session.current
  if (!current) return
  current.activity = text
  db.update(agents)
    .set({ state: 'working', activity: text })
    .where(eq(agents.id, session.agentId))
    .run()
  write(db, session, { kind: 'activity', text, phase: current.phase })
}

/**
 * The version, plus the generation that retires a key the runtime rejected.
 *
 * A generation of zero is left off the end, so the common case produces the
 * same key it always did and an existing session is not restarted by the
 * arrival of this field.
 */
function sessionVersion(
  input: BriefInput,
  env: Record<string, string>,
  generation: number,
): string {
  const base = briefVersion(input, env)
  return generation > 0 ? `${base}.${generation}` : base
}

/**
 * Gives up on a session the runtime will not resume.
 *
 * Closing it is not enough on its own: the key is derived from the brief, so
 * rebuilding produces the same key and acpx reads back the same unresumable
 * record from its own store. The provider offers no way to discard that
 * record, so the key is what has to change, and the generation is what
 * changes it. Persisted, because the record outlives this process.
 */
export async function retireSession(db: Db, agentId: string): Promise<void> {
  db.update(agents)
    .set({ sessionGeneration: sql`${agents.sessionGeneration} + 1` })
    .where(eq(agents.id, agentId))
    .run()
  await closeSession(agentId)
}

/** Forgets a session, closing the agent process behind it. */
export async function closeSession(agentId: string): Promise<void> {
  const session = sessions.get(agentId)
  if (!session) return
  sessions.delete(agentId)
  cancelAll(agentId)
  await session.provider.close('closed')
}

export function liveSession(agentId: string): AgentSession | undefined {
  return sessions.get(agentId)
}

export { target }
