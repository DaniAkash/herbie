import { createLogger } from '@bun/lib/log'
import { publish } from '@bun/modules/conversation/bus'
import { cancelAll, settle } from '@bun/modules/conversation/pending'
import { writeRecord } from '@bun/modules/conversation/records'
import {
  type AgentRow,
  type AgentSession,
  liveSession,
  retireSession,
  sessionFor,
  target,
  write,
} from '@bun/modules/conversation/sessions'
import type { Db } from '@bun/modules/db/db'
import { agents } from '@bun/modules/db/schema/schema'
import type { LiveTurn } from '@bun/shared/transcript'
import { streamText } from 'ai'
import { eq } from 'drizzle-orm'

const log = createLogger('turn')

/**
 * A turn: the person says something, the agent works, blocks arrive.
 *
 * The inversion that defines v2 lives in this file. The acpx stream is not
 * built into messages, it is telemetry: text and reasoning deltas move the
 * activity line and go to the raw log, and a tool call moves the turn from
 * thinking to working. The content arrives out of band, through the host
 * tools, already typed, because `execute` ran here in the sidecar.
 */

/** Raised when a second send arrives while a turn is still running. */
export class TurnInProgressError extends Error {
  readonly turnId: string
  constructor(turnId: string) {
    super('a turn is already running')
    this.name = 'TurnInProgressError'
    this.turnId = turnId
  }
}

export function liveTurn(agentId: string): LiveTurn | null {
  const current = liveSession(agentId)?.current
  if (!current) return null
  return {
    turnId: current.id,
    phase: current.phase,
    activity: current.activity,
    startedAt: current.startedAt,
    steps: current.steps,
    quietFor: Math.round((Date.now() - current.lastBlockAt) / 1000),
  }
}

/** How often progress reaches a watcher, at most. */
const PUSH_EVERY_MS = 1500

/**
 * Tells watchers the turn is still moving.
 *
 * Not a record: this is telemetry about a turn in flight and is kept nowhere.
 * It exists because an agent can work for minutes without reporting, and a
 * still indicator with a rising clock reads as a hung app rather than as work.
 */
function pushProgress(session: AgentSession, force = false): void {
  const current = session.current
  if (!current) return
  const now = Date.now()
  if (!force && now - current.lastPushAt < PUSH_EVERY_MS) return
  current.lastPushAt = now
  publish(session.agentId, { type: 'turn', live: liveTurn(session.agentId) })
}

function findAgent(db: Db, id: string): AgentRow | undefined {
  return db.select().from(agents).where(eq(agents.id, id)).get()
}

/**
 * Starts a turn and returns as soon as it is accepted.
 *
 * The caller gets a turn id, not a result: the blocks arrive over the stream
 * as the agent reports them, which is the only shape that works for a turn
 * that may run for an hour and may stop halfway to ask something.
 */
export function startTurn(
  db: Db,
  agentId: string,
  text: string,
): { turnId: string } {
  const agent = findAgent(db, agentId)
  if (!agent) throw new Error('no such agent')

  const existing = liveSession(agentId)?.current
  if (existing) throw new TurnInProgressError(existing.id)

  const session = sessionFor(db, agent)
  const turnId = `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const controller = new AbortController()

  session.current = {
    id: turnId,
    controller,
    startedAt: Date.now(),
    phase: 'thinking',
    activity: 'Thinking',
    reported: 0,
    text: '',
    steps: 0,
    lastBlockAt: Date.now(),
    lastPushAt: 0,
  }

  write(db, session, { kind: 'user', text })
  write(db, session, { kind: 'turn.start' })
  setState(db, agentId, 'working', 'Thinking')

  void run(db, session, agent, text).catch((cause) => {
    log.error('turn crashed outside its own handler', {
      agent: agentId,
      turn: turnId,
      cause: String(cause),
    })
  })

  return { turnId }
}

/**
 * Stops the turn in flight.
 *
 * The pending registry is drained first, so an `ask` or a permission request
 * that was blocking resolves rather than being left for a timeout. Then the
 * abort reaches the agent through acpx.
 */
export function cancelTurn(agentId: string, reason?: string): boolean {
  const session = liveSession(agentId)
  const current = session?.current
  if (!session || !current) return false
  cancelAll(agentId)
  current.controller.abort(new Error(reason ?? 'cancelled'))
  return true
}

/** Hands the person's answers to the `ask` call that is waiting for them. */
export function answer(
  db: Db,
  agentId: string,
  recordId: string,
  answers: Record<string, readonly number[]>,
): boolean {
  const session = liveSession(agentId)
  if (!session) return false
  if (!settle(agentId, recordId, answers)) return false
  writeRecord(db, target(session), { kind: 'answer', ref: recordId, answers })
  return true
}

async function run(
  db: Db,
  session: AgentSession,
  agent: AgentRow,
  text: string,
): Promise<void> {
  const current = session.current
  if (!current) return
  let reason: 'stop' | 'cancel' | 'error' = 'stop'
  let dead = false

  try {
    const result = streamText({
      model: session.provider.languageModel(),
      // Only the new message. acpx owns the agent's memory and reloads the
      // session on every call, so re-feeding the thread would show it every
      // prior turn twice.
      messages: [{ role: 'user', content: text }],
      abortSignal: current.controller.signal,
    })

    let failure: string | null = null
    for await (const part of result.fullStream) {
      session.transcript.appendRaw(current.id, part)
      failure ??= streamFailure(part)
      observe(db, session, part)
    }

    const finish = await result.finishReason
    if (finish === 'error') {
      reason = 'error'
      // The stream reports a failure as a part rather than by throwing, so
      // without this the turn ends silently and the person is told only that
      // there was nothing to report, which is not what happened.
      const text = failure ?? 'The agent stopped without saying why.'
      log.error('turn ended in error', { agent: agent.id, cause: text })
      write(db, session, { kind: 'error', text })
      dead = unresumable(text)
    }
  } catch (cause) {
    reason = current.controller.signal.aborted ? 'cancel' : 'error'
    if (reason === 'error') {
      log.error('turn failed', { agent: agent.id, cause: String(cause) })
      write(db, session, { kind: 'error', text: message(cause) })
    }
  } finally {
    await settleTurn(db, session, reason)
    // After the turn has settled, because settling reads the provider. A
    // session the runtime cannot resume fails the same way on every later
    // turn, so its key is retired here and the next send creates a session
    // rather than leaving the agent permanently unable to answer.
    if (dead) {
      log.warn('session cannot be resumed, retiring its key', {
        agent: agent.id,
      })
      await retireSession(db, session.agentId)
    }
  }
}

/**
 * The failure behind an errored turn, in the person's words where possible.
 *
 * Read from the step rather than the error part: the error part carries a
 * code and no message, and the message is on the step's provider metadata.
 */
function streamFailure(part: unknown): string | null {
  const typed = part as {
    type?: string
    providerMetadata?: { acpx?: { errorMessage?: unknown } }
  }
  if (typed.type !== 'finish-step') return null
  const text = typed.providerMetadata?.acpx?.errorMessage
  return typeof text === 'string' && text.length > 0 ? text : null
}

/**
 * Whether the session behind this failure is gone for good.
 *
 * Matched on the message because the code is `RUNTIME` for every runtime
 * fault and does not separate a dead session from a transient one. Being
 * wrong is cheap either way: a miss leaves today's behaviour, and a false
 * positive costs one fresh session.
 */
function unresumable(text: string): boolean {
  return /could not be resumed/i.test(text)
}

/**
 * What a stream part means for the live indicator, and nothing else.
 *
 * No part becomes a message. A `tool-call` is the signal that the agent has
 * stopped thinking and started doing, and the only reason its name is read is
 * to label the indicator when the agent has not labelled it itself.
 */
function observe(db: Db, session: AgentSession, part: unknown): void {
  const current = session.current
  if (!current) return
  const typed = part as { type?: string; text?: string }

  if (typed.type === 'text-delta' && typeof typed.text === 'string') {
    current.text += typed.text
    promote(db, session, 'working')
    return
  }
  if (typed.type === 'tool-call') {
    current.steps += 1
    promote(db, session, 'working')
    pushProgress(session)
  }
}

function promote(
  db: Db,
  session: AgentSession,
  phase: 'thinking' | 'working',
): void {
  const current = session.current
  if (!current || current.phase === phase) return
  current.phase = phase
  write(db, session, { kind: 'activity', text: current.activity, phase })
}

/**
 * Closes the turn, and refuses to leave the person with silence.
 *
 * A turn that reported nothing is the one obvious failure mode of a contract
 * carried by tool descriptions, so its final assistant text is promoted into
 * a `say` block, marked as having come from the fallback. The mark matters:
 * if this fires often the contract is not landing, and a quiet fallback would
 * hide that while looking like it worked.
 *
 * Only on a turn that ran to its end. A turn that was cancelled or that
 * failed has already said so, and telling the person there was nothing to
 * report would describe the wrong thing as the problem.
 */
async function settleTurn(
  db: Db,
  session: AgentSession,
  reason: 'stop' | 'cancel' | 'error',
): Promise<void> {
  const current = session.current
  if (!current) return

  if (current.reported === 0 && reason === 'stop') {
    const text = current.text.trim()
    write(db, session, {
      kind: 'say',
      text:
        text.length > 0
          ? text
          : 'I finished without anything to report. Ask me again and I will say what I found.',
      fallback: true,
    })
    log.warn('turn reported nothing, promoted its own text', {
      agent: session.agentId,
      turn: current.id,
      hadText: text.length > 0,
    })
  }

  const usage = session.provider.getUsage(
    `${session.agentId}:${session.version}`,
  )

  // The row settles before the record that announces it. turn.end is
  // published to every watcher as it is written, and the webview re-reads
  // the agent row when it sees one: written first, that read races this
  // update and wins, leaving the rail saying the agent is still thinking
  // about a turn that has already ended.
  setState(db, session.agentId, reason === 'error' ? 'stuck' : 'idle', null)

  write(db, session, {
    kind: 'turn.end',
    reason,
    ...(usage ? { usage: { used: usage.used, size: usage.size } } : {}),
  })

  // Last, because the write above files the record under it, and because a
  // send arriving before this point should still be told the agent is busy.
  session.current = null
}

/** The rail reads these two columns, so they move with the turn. */
function setState(
  db: Db,
  agentId: string,
  state: string,
  activity: string | null,
): void {
  db.update(agents).set({ state, activity }).where(eq(agents.id, agentId)).run()
}

function message(cause: unknown): string {
  if (cause instanceof Error) return cause.message
  return String(cause)
}
