import {
  askShape,
  explainShape,
  recommendShape,
  sayShape,
  setActivityShape,
  showCodeShape,
  showContextShape,
  showInsightShape,
  showTasksShape,
  showWorkShape,
} from '@bun/modules/conversation/reporting.schemas'
import type {
  AskQuestion,
  DraftRecord,
  TranscriptRecord,
} from '@bun/shared/transcript'
import type { AcpxHostTool, AcpxHostToolSchema } from 'acpx-ai-provider'
import { z } from 'zod'

/**
 * The reporting vocabulary: what the agent can put in front of the person.
 *
 * This file is the contract, not documentation of it. The descriptions below
 * are the only channel that reaches the model on every runtime: codex
 * advertises `sessionCapabilities.systemPrompt: false`, so a system prompt
 * cannot be relied on to carry any of this. Treat the wording as code.
 *
 * Nine flat tools rather than one `report({ kind, ... })` over a union,
 * because a model picks reliably between named tools with distinct
 * descriptions, and `oneOf` support across adapters is uneven.
 */

/** The standing rule, repeated in every description that needs it. */
const ONLY_CHANNEL =
  'The person sees nothing you write outside these tools. Your ordinary ' +
  'replies are not shown to them.'

/**
 * What the tools need from the turn they are running inside.
 *
 * Passed in rather than imported, so the contract can be exercised against a
 * fake without a session, a provider or an agent process.
 */
export interface ReportingContext {
  /** Writes the block and gives it its place in the order. */
  append: (draft: DraftRecord) => TranscriptRecord
  /** Waits for the person's answers to an `ask` block, or throws on abort. */
  awaitAnswers: (
    recordId: string,
    signal: AbortSignal,
  ) => Promise<Record<string, readonly number[]>>
  /** Changes what the live indicator says, without writing a block. */
  setActivity: (text: string) => void
}

/** Zod gives the typing and the validation; the agent is given JSON Schema. */
function schemaOf(shape: z.ZodType): AcpxHostToolSchema {
  return z.toJSONSchema(shape, {
    target: 'draft-7',
    io: 'input',
  }) as AcpxHostToolSchema
}

/**
 * Parses the arguments again on our side of the provider.
 *
 * The provider already checks them against the same schema, which is what
 * stops a number arriving where a string was declared. This second parse is
 * not for that: it is what turns `Record<string, unknown>` into a typed
 * value, so the block written to the transcript has the shape the renderer
 * compiles against rather than whatever got through.
 */
function parsed<T extends z.ZodType>(shape: T, input: unknown): z.infer<T> {
  return shape.parse(input)
}

/**
 * The nine tools, bound to one turn.
 *
 * Eight write a block and return a short acknowledgement, because the agent
 * needs to know the report landed and nothing more. `ask` is the exception:
 * it returns the person's answers, which is why it is a tool at all rather
 * than a block with a callback.
 */
export function reportingTools(
  ctx: ReportingContext,
): Record<string, AcpxHostTool> {
  const block = (draft: DraftRecord): string => {
    ctx.append(draft)
    return 'shown'
  }

  return {
    say: {
      description:
        'Say something to the person, in plain prose, as a chat message. ' +
        'This is the default and most turns need nothing else: greetings, ' +
        'short answers, progress notes, anything conversational. ' +
        ONLY_CHANNEL +
        ' Say things as you learn them rather than saving everything for ' +
        'the end: on a turn that takes a while, a short note when you ' +
        'find something, change direction or hit a dead end is worth more ' +
        'than a perfect summary the person waited minutes in silence for. ' +
        'Call it as often as you have something worth saying. Use explain ' +
        'instead only when you have sources to cite or sensible follow-up ' +
        'questions to offer.',
      inputSchema: schemaOf(sayShape),
      execute: (input) => block({ kind: 'say', ...parsed(sayShape, input) }),
    },

    explain: {
      description:
        'Give a researched answer, with the sources it came from and what ' +
        'the person might ask next. Use it when you went and found out, ' +
        'and the citations or the follow-up questions are part of the ' +
        'answer. It is presented as a document rather than a chat message, ' +
        'so it is the wrong shape for a greeting, a one-line reply or a ' +
        'progress note: those are say.',
      inputSchema: schemaOf(explainShape),
      execute: (input) =>
        block({ kind: 'explain', ...parsed(explainShape, input) }),
    },

    show_work: {
      description:
        'Show what you did, after you did it, as a compressed list of ' +
        'steps. Use this when the person would want to see the work ' +
        'rather than read about it: files read, commands run, edits made. ' +
        'Not for what you are about to do, and not for the state of ' +
        'several separate pieces of work, which is show_tasks.',
      inputSchema: schemaOf(showWorkShape),
      execute: (input) =>
        block({ kind: 'show_work', ...parsed(showWorkShape, input) }),
    },

    show_tasks: {
      description:
        'Show the state of several distinct pieces of work as rows, each ' +
        'either done or running. Use it when the person is tracking ' +
        'progress across things, not when you are describing the steps of ' +
        'one thing, which is show_work. There is no pending or failed ' +
        'status: a row that failed belongs in say, with the reason.',
      inputSchema: schemaOf(showTasksShape),
      execute: (input) =>
        block({ kind: 'show_tasks', ...parsed(showTasksShape, input) }),
    },

    show_code: {
      description:
        'Show code or a diff in a panel with a filename and a copy ' +
        'button. Use it whenever the code itself is the answer and the ' +
        'person will read it rather than skim it. Send code for a whole ' +
        'snippet or diff for a change; do not put code inside say, where ' +
        'it loses its formatting.',
      inputSchema: schemaOf(showCodeShape),
      execute: (input) =>
        block({ kind: 'show_code', ...parsed(showCodeShape, input) }),
    },

    recommend: {
      description:
        'Put a decision in front of the person with two to four options, ' +
        'one of them marked as your recommendation. Use it when you have ' +
        'a view and they should still choose. This does not wait for an ' +
        'answer and does not block: if you need one before you can carry ' +
        'on, use ask instead.',
      inputSchema: schemaOf(recommendShape),
      execute: (input) =>
        block({ kind: 'recommend', ...parsed(recommendShape, input) }),
    },

    show_context: {
      description:
        'Show the passages you read, each with its source, when the ' +
        'sources are the answer rather than evidence for one. Use it for ' +
        'research and quoting. If you are summarising what you found, use ' +
        'say and attach the sources to it.',
      inputSchema: schemaOf(showContextShape),
      execute: (input) =>
        block({ kind: 'show_context', ...parsed(showContextShape, input) }),
    },

    show_insight: {
      description:
        'Show numbers as a small chart with a sentence of reading. Three ' +
        'kinds only: compare for several things side by side, anomaly for ' +
        'one series with an outlier, allocation for parts of a whole. ' +
        'Anything else belongs in say. Use it when a sentence would lose ' +
        'the shape of the numbers.',
      inputSchema: schemaOf(showInsightShape),
      execute: (input) =>
        block({ kind: 'show_insight', ...parsed(showInsightShape, input) }),
    },

    ask: {
      description:
        'Ask the person one to four questions and wait for the answers. ' +
        'This is the only tool that blocks: it does not return until they ' +
        'reply, so call it when you genuinely cannot carry on without an ' +
        'answer, and not to confirm something you already know. The return ' +
        'value is their choices, by question index.',
      inputSchema: schemaOf(askShape),
      execute: async (input, { abortSignal }) => {
        const { questions } = parsed(askShape, input)
        const record = ctx.append({
          kind: 'ask',
          questions,
          answers: null,
        })
        const answers = await ctx.awaitAnswers(record.id, abortSignal)
        return describeAnswers(questions, answers)
      },
    },

    set_activity: {
      description:
        'Say what you are doing right now, in a few words. This is not a ' +
        'message: it replaces the label beside the working indicator. Call ' +
        'it every time you start a different piece of work, and before ' +
        'anything that will take a while. During a long turn this label is ' +
        'the only thing the person has to look at, so a stale one reads as ' +
        'the app having hung.',
      inputSchema: schemaOf(setActivityShape),
      execute: (input) => {
        ctx.setActivity(parsed(setActivityShape, input).text)
        return 'noted'
      },
    },
  }
}

/**
 * The answers, in words rather than indices.
 *
 * The agent chose the option labels, but it did not choose their order in its
 * own context window, and handing back `{"0":[1]}` makes it count. Returning
 * the text it wrote is both unambiguous and cheaper to reason about.
 */
function describeAnswers(
  questions: readonly AskQuestion[],
  answers: Record<string, readonly number[]>,
): string {
  const lines = questions.map((question, index) => {
    const picked = answers[String(index)] ?? []
    const labels = picked.map((at) => question.options[at] ?? `#${at}`)
    return `${question.q} ${labels.length > 0 ? labels.join(', ') : '(no answer)'}`
  })
  return lines.join('\n')
}

/** The tool names, for the brief and for a test that the two agree. */
export const REPORTING_TOOL_NAMES = [
  'say',
  'explain',
  'show_work',
  'show_tasks',
  'show_code',
  'recommend',
  'show_context',
  'show_insight',
  'ask',
  'set_activity',
] as const
