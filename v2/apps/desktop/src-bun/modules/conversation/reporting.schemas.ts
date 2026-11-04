import { z } from 'zod'

/**
 * The argument shapes for the reporting tools, as zod.
 *
 * One source of truth, two consumers: the tool handler parses with these to
 * get a typed block, and the agent is handed `z.toJSONSchema` of the same
 * object so what it is told matches what is enforced. A hand-written JSON
 * Schema beside a zod type is two copies of a rule, and the one that drifts
 * is always the one the agent reads.
 *
 * Every object is `.strict()`, so an argument nobody declared is a rejected
 * call rather than a field silently dropped on the way to the transcript.
 */

export const sayShape = z
  .object({
    text: z
      .string()
      .min(1)
      .max(4000)
      .describe('Plain prose. No markdown; asterisks arrive as asterisks.'),
    sources: z
      .array(
        z.object({
          name: z.string().min(1),
          domain: z.string().min(1),
          href: z.string().min(1),
        }),
      )
      .max(10)
      .optional()
      .describe('Where this came from, when it came from somewhere.'),
    followUps: z
      .array(z.string().min(1).max(80))
      .max(3)
      .optional()
      .describe('Up to three things the person might ask next.'),
  })
  .strict()

export const showWorkShape = z
  .object({
    steps: z
      .array(
        z
          .object({
            icon: z
              .enum(['think', 'read', 'write', 'run'])
              .describe('Which of the four kinds of step this was.'),
            label: z.string().min(1).max(120),
            chip: z
              .string()
              .min(1)
              .max(16)
              .describe('One status word, such as done, skipped or failed.'),
            mono: z
              .boolean()
              .optional()
              .describe('True when the label is a path or a command.'),
            detail: z
              .array(
                z
                  .object({
                    text: z.string().min(1).max(200),
                    tone: z.literal('add').optional(),
                  })
                  .strict(),
              )
              .max(8)
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    diffs: z
      .array(
        z
          .object({
            file: z.string().min(1),
            add: z.number().int().min(0),
            del: z.number().int().min(0),
          })
          .strict(),
      )
      .max(12)
      .optional(),
  })
  .strict()

export const showTasksShape = z
  .object({
    rows: z
      .array(
        z
          .object({
            label: z.string().min(1).max(120),
            amount: z
              .string()
              .max(24)
              .optional()
              .describe('A count or size for the right-hand column.'),
            status: z
              .enum(['done', 'running'])
              .describe('Only these two. There is no pending or failed row.'),
            details: z
              .array(
                z
                  .object({
                    label: z.string().min(1).max(80),
                    meta: z.string().max(80),
                  })
                  .strict(),
              )
              .max(6)
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict()

export const showCodeShape = z
  .object({
    filename: z.string().min(1).max(200),
    code: z
      .string()
      .max(20_000)
      .optional()
      .describe('The whole snippet, newline separated. Use this or diff.'),
    diff: z
      .array(
        z
          .object({
            old: z.number().int().nullable(),
            cur: z.number().int().nullable(),
            type: z.enum(['ctx', 'add', 'del']),
            text: z.string().max(400),
          })
          .strict(),
      )
      .max(400)
      .optional()
      .describe('Line by line, when the change matters more than the file.'),
  })
  .strict()

export const recommendShape = z
  .object({
    title: z.string().min(1).max(160).describe('The decision, as a question.'),
    options: z
      .array(
        z
          .object({
            label: z.string().min(1).max(80),
            detail: z.string().min(1).max(400),
            signal: z
              .string()
              .min(1)
              .max(80)
              .describe('Why this one, in a few words.'),
            recommended: z.boolean().optional(),
          })
          .strict(),
      )
      .min(2)
      .max(4)
      .describe('Mark exactly one as recommended.'),
  })
  .strict()

export const showContextShape = z
  .object({
    header: z.string().min(1).max(120),
    chunks: z
      .array(
        z
          .object({
            source: z.string().min(1).max(120),
            text: z.string().min(1).max(1200),
            href: z.string().max(400).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict()

export const showInsightShape = z
  .object({
    title: z.string().min(1).max(120),
    pages: z
      .array(
        z
          .object({
            kind: z
              .enum(['compare', 'anomaly', 'allocation'])
              .describe(
                'compare for several things side by side, anomaly for one ' +
                  'series with an outlier, allocation for parts of a whole.',
              ),
            heading: z.string().min(1).max(80),
            prose: z.string().min(1).max(600),
            series: z
              .array(
                z
                  .object({
                    label: z.string().min(1).max(40),
                    value: z.number(),
                  })
                  .strict(),
              )
              .min(2)
              .max(12),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict()

export const askShape = z
  .object({
    questions: z
      .array(
        z
          .object({
            q: z.string().min(1).max(300),
            type: z
              .enum(['radio', 'check'])
              .describe('radio for one answer, check for several.'),
            options: z.array(z.string().min(1).max(120)).min(2).max(6),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict()

export const setActivityShape = z
  .object({
    text: z
      .string()
      .min(1)
      .max(80)
      .describe('A short phrase, present tense, such as "Reading the feed".'),
  })
  .strict()
