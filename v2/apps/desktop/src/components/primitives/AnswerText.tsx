import type { ReactNode } from 'react'
import { useState } from 'react'
import { type Components, Streamdown } from 'streamdown'

/**
 * A researched answer: markdown, its sources, and what to ask next.
 *
 * Built from the registry's `StreamingText`, keeping its action row, source
 * chips and follow-up list, and replacing the thing at its centre. That
 * component owned a word counter and a timer, so it revealed text rather
 * than rendering it: the reveal replayed from zero on every mount, which
 * re-typed settled answers as the thread scrolled, and its tokens were
 * whitespace-split words, so markdown arrived as literal asterisks.
 *
 * A block is written by one tool call and arrives whole, so there is no
 * stream to follow. `mode="static"` says exactly that to streamdown, and
 * there is deliberately no `animated`: its rule is that newly mounted spans
 * animate, which on a first render is all of them, and that is the mount
 * replay again under another name.
 */

export interface AnswerSource {
  readonly name: string
  readonly domain: string
  readonly href: string
  readonly image: string
}

export function AnswerText({
  children,
  sources = [],
  followUps = [],
  sourcesLabel,
  followUpsLabel = 'You might ask',
  onFollowUp,
  followUpsDisabled = false,
}: {
  /** The answer, as markdown. */
  children: string
  sources?: readonly AnswerSource[]
  followUps?: readonly string[]
  /** Overrides the counted default, for a caller that counts differently. */
  sourcesLabel?: string
  followUpsLabel?: string
  onFollowUp?: (text: string, index: number) => void
  followUpsDisabled?: boolean
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false)

  return (
    <div className="w-full">
      <Streamdown
        mode="static"
        parseIncompleteMarkdown={false}
        controls={false}
        components={MARKDOWN}
        className="text-[13px] leading-relaxed text-ink [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      >
        {children}
      </Streamdown>

      {sources.length > 0 ? (
        <>
          <div className="mt-2 flex items-center gap-0.5">
            <CopyButton text={children} />
            <button
              type="button"
              aria-expanded={sourcesOpen}
              onClick={() => setSourcesOpen((open) => !open)}
              className="ml-1.5 flex items-center gap-1.5 rounded-[6px] px-1 py-0.5 text-left transition-colors duration-150 hover:bg-hover"
            >
              <span className="flex -space-x-1">
                {sources.map((source) => (
                  <img
                    key={source.domain}
                    src={source.image}
                    alt=""
                    className="source-avatar size-3.5 rounded-full bg-surface shadow-[0_0_0_1.5px_var(--canvas)]"
                  />
                ))}
              </span>
              <span className="text-[12px] text-ink-2">
                {sourcesLabel ?? countedSources(sources.length)}
              </span>
            </button>
          </div>

          <div
            className="grid transition-[grid-template-rows,opacity] duration-300"
            style={{
              gridTemplateRows: sourcesOpen ? '1fr' : '0fr',
              opacity: sourcesOpen ? 1 : 0,
              transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
            }}
          >
            <div className="overflow-hidden">
              <div className="mt-1.5 flex flex-col rounded-[10px] bg-inset p-1 shadow-hairline">
                {sources.map((source) => (
                  <a
                    key={source.domain}
                    href={webHref(source.href)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-[6px] px-1.5 py-1 text-[12px] text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink"
                  >
                    <img
                      src={source.image}
                      alt=""
                      className="source-avatar size-4 rounded-[4px]"
                    />
                    <span className="animated-underline">{source.name}</span>
                    <span className="ml-auto font-mono text-[10.5px] text-ink-3">
                      {source.domain}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {followUps.length > 0 ? (
        <div className="mt-2.5">
          <p className="text-[12px] font-medium text-ink-2">{followUpsLabel}</p>
          <div className="mt-0.5 flex flex-col">
            {followUps.map((text, i) => (
              <button
                key={text}
                type="button"
                disabled={followUpsDisabled || !onFollowUp}
                onClick={() => onFollowUp?.(text, i)}
                className="-mx-1.5 flex items-center gap-2 rounded-[7px] border-b border-line
                  px-1.5 py-1.5 text-left text-[12.5px] text-ink transition-colors
                  duration-100 hover:bg-hover-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ink-3)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <path d="M9 10l-5 5 5 5" />
                  <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                </svg>
                {text}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * A link, or nothing, so that only the two web schemes become an `href`.
 *
 * The schema already refuses anything else and the window's content policy
 * already refuses to run `javascript:`, which makes this the third lock on
 * the same door. It is here anyway because this is the component that hands
 * a string the agent wrote to the operating system, and the cost of being
 * sure at that point is one function.
 */
function webHref(href: string | undefined): string | undefined {
  if (href === undefined) return undefined
  return /^https?:\/\//i.test(href) ? href : undefined
}

function countedSources(count: number): string {
  return count === 1 ? '1 source' : `${count} sources`
}

/**
 * Every element the answer can contain, drawn in Herbie's own type scale.
 *
 * An override replaces streamdown's renderer outright rather than adding to
 * it, which is the point: its defaults carry a heavier scale than a chat
 * thread wants, and its code and table blocks ship copy, download and
 * fullscreen buttons that belong in a document viewer. `controls={false}`
 * turns those off, and these put the rest on our tokens. Styling them from
 * the outside was tried first and loses, because the defaults are classes on
 * the elements themselves rather than something a parent can quietly beat.
 */
type Slot = { children?: ReactNode }

// Streamdown combines intrinsic props with an incompatible catch-all index signature.
const MARKDOWN = {
  p: ({ children }: Slot) => <p className="my-1.5">{children}</p>,
  h1: ({ children }: Slot) => (
    <h1 className="mt-4 mb-1.5 text-[16px] font-semibold">{children}</h1>
  ),
  h2: ({ children }: Slot) => (
    <h2 className="mt-4 mb-1.5 text-[14.5px] font-semibold">{children}</h2>
  ),
  h3: ({ children }: Slot) => (
    <h3 className="mt-3 mb-1 text-[13.5px] font-semibold">{children}</h3>
  ),
  h4: ({ children }: Slot) => (
    <h4 className="mt-3 mb-1 text-[13px] font-semibold text-ink-2">
      {children}
    </h4>
  ),
  ul: ({ children }: Slot) => (
    <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>
  ),
  ol: ({ children }: Slot) => (
    <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>
  ),
  li: ({ children }: Slot) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }: Slot) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }: Slot) => <em className="italic">{children}</em>,
  a: ({ children, href }: Slot & { href?: string }) => (
    <a
      href={webHref(href)}
      target="_blank"
      rel="noreferrer"
      className="text-ink underline decoration-line underline-offset-2 transition-colors hover:decoration-ink-3"
    >
      {children}
    </a>
  ),
  inlineCode: ({ children }: Slot) => (
    <code className="rounded-[4px] bg-inset px-1 py-px font-mono text-[12px] text-ink-2">
      {children}
    </code>
  ),
  // The child `code` is the same override as an inline span, because without
  // a highlighter plugin a fence falls back to it. Its chip padding and fill
  // are undone here rather than conditionally applied there, so inline code
  // keeps one definition and the block is a block.
  pre: ({ children }: Slot) => (
    <pre
      className="my-2 overflow-x-auto rounded-[8px] bg-inset p-2.5 font-mono text-[12px] leading-[1.55] text-ink-2 shadow-hairline
        [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[12px]"
    >
      {children}
    </pre>
  ),
  blockquote: ({ children }: Slot) => (
    <blockquote className="my-2 border-l-2 border-line pl-2.5 text-ink-2">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-0 border-t border-line" />,
  table: ({ children }: Slot) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }: Slot) => (
    <th className="border-b border-line pr-3 pb-1 font-medium">{children}</th>
  ),
  td: ({ children }: Slot) => (
    <td className="border-b border-line py-1 pr-3 align-top text-ink-2">
      {children}
    </td>
  ),
} as unknown as Components

/**
 * Copies the answer's markdown, and says so for a moment.
 *
 * The registry's row carried four buttons, of which this is the only one
 * with anything behind it here. Retry and the two ratings needed a handler
 * the thread does not have, and a button that does nothing when clicked is
 * worse than an absent one.
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : 'Copy answer'}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        })
      }}
      className="flex size-6 items-center justify-center rounded-[6px] text-ink-3
        transition-colors duration-100 hover:bg-hover-2 hover:text-ink-2"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {copied ? (
          <path d="M20 6 9 17l-5-5" />
        ) : (
          <>
            <rect x="9" y="9" width="12" height="12" rx="2.5" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </>
        )}
      </svg>
    </button>
  )
}
