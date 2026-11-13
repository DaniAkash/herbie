import { type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import type {
  CodeBlockProps,
  CodePiece,
  DiffRow,
} from '@/screens/conversation/blocks/code-block.types'

const COPIED_MS = 1500

const HATCH =
  'repeating-linear-gradient(45deg, var(--red) 0, var(--red) 1.5px, transparent 1.5px, transparent 3px)'

/**
 * Code, or a unified diff of it.
 *
 * Which one is decided by the shape of the props rather than a flag, so a
 * caller with a diff to show cannot accidentally get the listing view.
 */
export function CodeBlock(props: CodeBlockProps) {
  const { filename, diff, lines } = props
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText((lines ?? []).join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_MS)
    })
  }

  return (
    <div className="w-full max-w-105 overflow-hidden rounded-card bg-surface shadow-card">
      <div className="flex h-11 items-center gap-2 border-line border-b px-4 text-[12.5px]">
        <span className="inline-flex min-w-0 items-center gap-[7px]">
          <FileIcon />
          <span className="truncate font-mono text-ink leading-none">
            {filename}
          </span>
        </span>

        {diff ? (
          <DiffStat diff={diff} />
        ) : (
          <button
            type="button"
            aria-label="Copy code"
            onClick={copy}
            className={cn(
              '-mr-1 ml-auto flex h-6 items-center gap-1 rounded-[6px] px-1.5 font-medium text-[12px] transition-colors duration-100 hover:bg-hover',
              copied ? 'text-green' : 'text-ink-3 hover:text-ink',
            )}
          >
            {copied ? <TickIcon /> : <CopyIcon />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      <div className="py-3 font-mono text-[12.5px] text-ink-2 leading-[1.65]">
        <div className="relative">
          {/* The gutter rule, drawn once rather than per row. */}
          <span className="pointer-events-none absolute inset-y-0 left-5 w-px bg-line" />
          {diff ? <DiffRows diff={diff} /> : <Listing lines={lines ?? []} />}
        </div>
      </div>
    </div>
  )
}

function DiffStat({ diff }: { diff: DiffRow[] }) {
  return (
    <span className="ml-auto inline-flex items-center gap-2 font-mono text-[12px] tabular-nums leading-none">
      <span className="text-green">
        +{diff.filter((row) => row.type === 'add').length}
      </span>
      <span className="text-red">
        -{diff.filter((row) => row.type === 'del').length}
      </span>
    </span>
  )
}

function DiffRows({ diff }: { diff: DiffRow[] }) {
  const keyed = diff.map((row, at) => ({
    at: `${at}:${row.type}${row.old ?? ''}-${row.cur ?? ''}`,
    row,
  }))
  return keyed.map((entry) => <DiffLine key={entry.at} row={entry.row} />)
}

function DiffLine({ row }: { row: DiffRow }) {
  const add = row.type === 'add'
  const del = row.type === 'del'
  const tone = add ? 'text-green' : del ? 'text-red' : 'text-ink-3'

  return (
    <div
      className={cn(
        'relative grid grid-cols-[20px_minmax(0,1fr)] items-start',
        add && 'bg-green-tint',
        del && 'bg-red-tint',
      )}
    >
      {add || del ? (
        <span
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: add ? 'var(--green)' : HATCH }}
        />
      ) : null}
      {/* One gutter column: a removal keeps the old number, anything else
          shows the new one. */}
      <span className={cn('select-none text-center text-[11px]', tone)}>
        {(del ? row.old : row.cur) ?? ''}
      </span>
      <code className="whitespace-pre-wrap break-words pr-3 pl-1">
        <Pieces pieces={row.pieces} />
      </code>
    </div>
  )
}

function Listing({ lines }: { lines: string[] }) {
  const numbered = lines.map((text, at) => ({ n: at + 1, text }))
  return numbered.map((line) => (
    <div
      key={line.n}
      className="grid grid-cols-[20px_minmax(0,1fr)] items-start"
    >
      <span className="select-none text-center text-[11px] text-ink-3">
        {line.n}
      </span>
      <code className="whitespace-pre-wrap break-words pr-3 pl-1">
        {highlight(line.text)}
      </code>
    </div>
  ))
}

function Pieces({ pieces }: { pieces: CodePiece[] }) {
  const indexed = pieces.map((piece, at) => ({ at, piece }))
  return (
    <>
      {indexed.map(({ at, piece }) => {
        if (!piece.change) {
          return <span key={at}>{highlight(piece.text)}</span>
        }
        const add = piece.change === 'add'
        return (
          <span
            key={at}
            className="rounded-[3px]"
            style={{
              background: `color-mix(in srgb, var(--${add ? 'green' : 'red'}) 18%, transparent)`,
              padding: '0 2px',
              margin: '0 -1px',
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone',
            }}
          >
            {highlight(piece.text)}
          </span>
        )
      })}
    </>
  )
}

const KEYWORDS = new Set([
  'import',
  'from',
  'export',
  'default',
  'async',
  'function',
  'const',
  'let',
  'var',
  'await',
  'return',
  'if',
  'else',
  'for',
  'while',
  'new',
  'throw',
  'try',
  'catch',
  'null',
  'true',
  'false',
  'undefined',
])

const TOKEN =
  /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`|\b\d+(?:\.\d+)?\b|\b(?:import|from|export|default|async|function|const|let|var|await|return|if|else|for|while|new|throw|try|catch|null|true|false|undefined)\b|[A-Za-z_$][\w$]*(?=\s*\())/g

/** Strings and numbers, keywords, and anything called as a function. */
function highlight(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let k = 0
  for (const match of text.matchAll(TOKEN)) {
    const at = match.index ?? 0
    const token = match[0]
    if (at > last) {
      k += 1
      nodes.push(<span key={k}>{text.slice(last, at)}</span>)
    }
    let color: string
    let weight: number | undefined
    if (/^["'`]/.test(token) || /^\d/.test(token)) color = 'var(--orange)'
    else if (KEYWORDS.has(token)) color = 'var(--accent-ink)'
    else {
      color = 'var(--ink)'
      weight = 500
    }
    k += 1
    nodes.push(
      <span key={k} style={{ color, fontWeight: weight }}>
        {token}
      </span>,
    )
    last = at + token.length
  }
  if (last < text.length) {
    k += 1
    nodes.push(<span key={k}>{text.slice(last)}</span>)
  }
  return nodes
}

function FileIcon() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-ink-3"
    >
      <path d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
    </svg>
  )
}

function TickIcon() {
  return (
    <svg
      aria-hidden="true"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}
