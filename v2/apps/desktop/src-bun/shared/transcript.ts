/**
 * The conversation's record shapes, named once for both ends.
 *
 * A record is one line of an agent's transcript and one block in the thread.
 * The union is discriminated on `kind`, which is also the name of the tool
 * the agent called to produce it, so the renderer's switch and the agent's
 * vocabulary cannot drift apart without the compiler saying so.
 *
 * This lives in `shared/` rather than next to the runtime because a block's
 * payload is a component's props. The sidecar writes them and the webview
 * renders them, and nothing in between is allowed to reshape them.
 */

/** A word of a `say` block. `cite` marks it as carrying a source marker. */
export interface SayToken {
  readonly text: string
  readonly cite?: boolean
}

export interface SaySource {
  readonly name: string
  readonly domain: string
  readonly href: string
}

/** One line of a tool chip's expanded detail. */
export interface WorkDetail {
  readonly text: string
  readonly tone?: 'add'
}

export interface WorkStep {
  /** think | read | write | run. Chosen by the agent, drawn by the chip. */
  readonly icon: string
  readonly label: string
  /** The short status word on the chip, such as done or skipped. */
  readonly chip: string
  readonly mono?: boolean
  readonly detail?: readonly WorkDetail[]
}

export interface WorkDiff {
  readonly file: string
  readonly add: number
  readonly del: number
}

export interface TaskRowRecord {
  readonly label: string
  readonly amount?: string
  /**
   * done | running only.
   *
   * The component's third status, `sequence`, drives itself from a hardcoded
   * timeline, so a row given it would animate through states the work never
   * went through. The tool's schema refuses it for that reason.
   */
  readonly status: 'done' | 'running'
  readonly details?: readonly { label: string; meta: string }[]
}

export interface CodeDiffRow {
  readonly old: number | null
  readonly cur: number | null
  readonly type: 'ctx' | 'add' | 'del'
  readonly text: string
}

export interface RecommendOption {
  readonly label: string
  readonly detail: string
  /**
   * How sure the agent is, drawn as the card's three-bar meter.
   *
   * An enum rather than prose because the component plots it. Asking for a
   * sentence and drawing a bar from its position in the list would be the
   * card inventing a confidence the agent never stated.
   */
  readonly confidence: 'strong' | 'fair' | 'weak'
  /** Exactly one option should be the default. */
  readonly recommended?: boolean
}

export interface ContextChunk {
  readonly source: string
  readonly text: string
  readonly href?: string
}

/**
 * The three chart kinds the insight component actually ships.
 *
 * Closed rather than open because `InsightCards` takes a React component per
 * page, which an agent cannot send. A Herbie wrapper maps each kind to the
 * chart it owns, so the honest limit is three kinds and the schema says so.
 */
export type InsightKind = 'compare' | 'anomaly' | 'allocation'

export interface InsightPage {
  readonly kind: InsightKind
  readonly heading: string
  readonly prose: string
  readonly series: readonly { label: string; value: number }[]
}

export interface AskQuestion {
  readonly q: string
  readonly type: 'radio' | 'check'
  readonly options: readonly string[]
}

/** An ACP permission option, carried through verbatim. */
export interface PermissionChoice {
  readonly optionId: string
  readonly name: string
  readonly kind: string
}

/** What every record carries, whoever wrote it. */
interface RecordBase {
  /** Monotonic per agent, and the cursor both routes take. */
  readonly seq: number
  readonly id: string
  readonly at: string
  readonly turn: string
}

export type TranscriptRecord = RecordBase &
  (
    | { readonly kind: 'user'; readonly text: string }
    | { readonly kind: 'turn.start' }
    | {
        readonly kind: 'turn.end'
        readonly reason: 'stop' | 'cancel' | 'error'
        readonly usage?: { readonly used?: number; readonly size?: number }
      }
    | {
        readonly kind: 'activity'
        readonly text: string
        readonly phase: 'thinking' | 'working'
      }
    | {
        readonly kind: 'say'
        readonly text: string
        readonly sources?: readonly SaySource[]
        /**
         * Set when the turn reported nothing and the final assistant text was
         * promoted into a block rather than leaving the person with silence.
         * Rendered with a visible seam: a quiet fallback is worse than a loud
         * one, because it hides that the contract did not land.
         */
        readonly fallback?: true
      }
    | {
        readonly kind: 'show_work'
        readonly steps: readonly WorkStep[]
        readonly diffs?: readonly WorkDiff[]
      }
    | { readonly kind: 'show_tasks'; readonly rows: readonly TaskRowRecord[] }
    | {
        readonly kind: 'show_code'
        readonly filename: string
        readonly code?: string
        readonly diff?: readonly CodeDiffRow[]
      }
    | {
        readonly kind: 'recommend'
        readonly title: string
        readonly options: readonly RecommendOption[]
      }
    | {
        readonly kind: 'show_context'
        readonly header: string
        readonly chunks: readonly ContextChunk[]
      }
    | {
        readonly kind: 'show_insight'
        readonly title: string
        readonly pages: readonly InsightPage[]
      }
    | {
        readonly kind: 'ask'
        readonly questions: readonly AskQuestion[]
        /** Null while it is still waiting, which is also what makes it pending. */
        readonly answers: Readonly<Record<string, readonly number[]>> | null
      }
    | {
        readonly kind: 'answer'
        /** The `ask` record this answers. */
        readonly ref: string
        readonly answers: Readonly<Record<string, readonly number[]>>
      }
    | {
        readonly kind: 'permission'
        readonly requestId: string
        readonly toolName: string
        readonly detail: string
        readonly options: readonly PermissionChoice[]
        /** The chosen optionId, or null while it is still waiting. */
        readonly decision: string | null
      }
    | {
        readonly kind: 'decision'
        /** The `permission` record this settles. */
        readonly ref: string
        /** The chosen optionId, or null when the turn was cancelled. */
        readonly optionId: string | null
      }
    | { readonly kind: 'error'; readonly text: string }
  )

export type RecordKind = TranscriptRecord['kind']

/**
 * A record before the transcript has given it a place.
 *
 * `turn` is omitted along with the ordering fields because the writer is
 * bound to a turn already: a caller that could name a different one could
 * file a block under a turn it does not belong to.
 */
export type DraftRecord = DistributiveOmit<
  TranscriptRecord,
  'seq' | 'id' | 'at' | 'turn'
>

/**
 * `Omit` over a union, which the built-in is not.
 *
 * `Omit<TranscriptRecord, ...>` collapses fourteen variants into one object
 * carrying only the keys they all share, which is `kind` and nothing else.
 * Distributing over the union first is what keeps each block's own payload.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

/** The turn in flight, which is what the indicator draws. */
export interface LiveTurn {
  readonly turnId: string
  readonly phase: 'thinking' | 'working'
  readonly activity: string
  /** Epoch milliseconds, so the elapsed clock survives a reconnect. */
  readonly startedAt: number
}

/** What the replay route answers with, and what the stream pushes one of. */
export interface TranscriptPage {
  readonly records: readonly TranscriptRecord[]
  readonly lastSeq: number
  readonly live: LiveTurn | null
}
