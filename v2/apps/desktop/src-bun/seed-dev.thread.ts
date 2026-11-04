import type { DraftRecord } from '@bun/shared/transcript'

/**
 * One thread that exercises every block the agent can report.
 *
 * Written as records rather than rows, because that is what a thread is now.
 * It covers all nine tools plus the question, the permission and the failure,
 * so a development install can be looked at once and every renderer checked
 * without an agent having to produce each one on demand.
 */
export const POSTMAN_THREAD: readonly DraftRecord[] = [
  { kind: 'user', text: 'Draft today’s posts from what I shipped this week.' },
  { kind: 'turn.start' },
  { kind: 'activity', text: 'Reading the feed', phase: 'working' },
  { kind: 'say', text: 'On it. Reading what you shipped this week.' },
  {
    kind: 'explain',
    text: 'Five drafts are ready. Two are worth posting and the rest need an angle. Nothing is queued or published.',
    sources: [
      {
        name: 'GitHub',
        domain: 'github.com',
        href: 'https://github.com/DaniAkash',
      },
    ],
    followUps: ['Show me the two', 'Why are the others weak'],
  },
  {
    kind: 'show_work',
    steps: [
      {
        icon: 'read',
        label: 'Read 41 commits across 6 repositories',
        chip: 'done',
      },
      {
        icon: 'think',
        label: 'Ranked them by what would read well cold',
        chip: 'done',
        detail: [{ text: 'Two land without context. Three need a setup.' }],
      },
      {
        icon: 'write',
        label: 'drafts/2026-11-04.md',
        chip: 'written',
        mono: true,
      },
    ],
    diffs: [{ file: 'drafts/2026-11-04.md', add: 48, del: 0 }],
  },
  {
    kind: 'show_tasks',
    rows: [
      { label: 'Draft the two strong posts', amount: '2', status: 'done' },
      {
        label: 'Find an angle for the rest',
        amount: '3',
        status: 'running',
        details: [{ label: 'Blocked on', meta: 'what the release is for' }],
      },
    ],
  },
  {
    kind: 'show_code',
    filename: 'drafts/2026-11-04.md',
    code: [
      '# The one that works',
      '',
      'Shipped a thing that reads your agent’s own output and refuses',
      'to show you any of it. The agent reports instead.',
    ].join('\n'),
  },
  {
    kind: 'show_context',
    header: 'What I read',
    chunks: [
      {
        source: 'CHANGELOG.md',
        text: 'The conversation no longer renders agent output. Blocks are reported through a fixed vocabulary of tools.',
      },
      {
        source: 'release notes',
        text: 'Host tools over MCP: the provider serves the host’s own functions to the agent as a loopback MCP server.',
        href: 'https://github.com/DaniAkash/agent-toolkit/releases',
      },
    ],
  },
  {
    kind: 'show_insight',
    title: 'What got attention last week',
    pages: [
      {
        kind: 'compare',
        heading: 'By post',
        prose: 'The shortest one did best, as usual.',
        series: [
          { label: 'Agent reporting', value: 1840 },
          { label: 'Tauri rewrite', value: 920 },
          { label: 'Release notes', value: 310 },
        ],
      },
      {
        kind: 'anomaly',
        heading: 'Impressions by day',
        prose: 'Thursday is not a pattern, it is one post.',
        series: [
          { label: 'Mon', value: 210 },
          { label: 'Tue', value: 240 },
          { label: 'Wed', value: 195 },
          { label: 'Thu', value: 1840 },
          { label: 'Fri', value: 260 },
        ],
      },
      {
        kind: 'allocation',
        heading: 'Where the week went',
        prose: 'Mostly the one feature, which is the right shape.',
        series: [
          { label: 'The conversation', value: 62 },
          { label: 'Host tools', value: 24 },
          { label: 'Everything else', value: 14 },
        ],
      },
    ],
  },
  {
    kind: 'recommend',
    title: 'How should the first one go out?',
    options: [
      {
        label: 'Post it as a quote post',
        detail:
          'It needs the original to make sense, and the quote keeps the preview.',
        confidence: 'strong',
        recommended: true,
      },
      {
        label: 'Post it on its own',
        detail: 'Reads fine cold, but loses the thread it is answering.',
        confidence: 'fair',
      },
      {
        label: 'Hold it for Monday',
        detail:
          'Thursday evening is your worst slot, but a week is a long hold.',
        confidence: 'weak',
      },
    ],
  },
  { kind: 'turn.end', reason: 'stop' },

  { kind: 'user', text: 'Quote post it. Hold the rest.' },
  { kind: 'turn.start' },
  {
    kind: 'ask',
    questions: [
      {
        q: 'Posting is one of your ask-first rules. Publish the quote post now?',
        type: 'radio',
        options: ['Publish it', 'Show me the text first', 'Hold it'],
      },
    ],
    answers: null,
  },
  { kind: 'turn.end', reason: 'stop' },
]

/** A short thread per other agent, so the rail is not all empty. */
export const OTHER_THREADS: Readonly<Record<string, readonly DraftRecord[]>> = {
  ops: [
    {
      kind: 'say',
      text: 'Release notes are drafted. Nine merged pull requests, grouped into three themes.',
    },
  ],
  scout: [
    {
      kind: 'show_tasks',
      rows: [
        { label: 'Pull requests needing review', amount: '4', status: 'done' },
        {
          label: 'Watching two failing checks',
          amount: '2',
          status: 'running',
        },
      ],
    },
  ],
  inboxer: [
    {
      kind: 'say',
      text: 'Filed 23 messages. Four are flagged for you, the rest archived by rule.',
    },
  ],
  watchdog: [
    {
      kind: 'say',
      text: 'Could not reach the registry. I stopped before changing anything.',
    },
    {
      kind: 'error',
      text: 'Four attempts failed in a row. Pausing myself until you look.',
    },
  ],
  housekeeper: [
    { kind: 'say', text: 'Guanciale, pecorino, eggs, black pepper.' },
  ],
}
