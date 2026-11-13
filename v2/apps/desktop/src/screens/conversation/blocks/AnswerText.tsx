import { useState } from 'react'
import { Streamdown } from 'streamdown'
import {
  countedSources,
  webHref,
} from '@/screens/conversation/blocks/answer-text.helpers'
import { MARKDOWN } from '@/screens/conversation/blocks/answer-text.markdown'

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
}: {
  /** The answer, as markdown. */
  children: string
  sources?: readonly AnswerSource[]
  followUps?: readonly string[]
  /** Overrides the counted default, for a caller that counts differently. */
  sourcesLabel?: string
  followUpsLabel?: string
  onFollowUp?: (text: string, index: number) => void
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false)

  return (
    <div className="w-full">
      <Streamdown
        mode="static"
        parseIncompleteMarkdown={false}
        controls={false}
        components={MARKDOWN}
        className="text-[13px] text-ink leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
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
          <p className="font-medium text-[12px] text-ink-2">{followUpsLabel}</p>
          <div className="mt-0.5 flex flex-col">
            {followUps.map((text, i) => (
              <button
                key={text}
                type="button"
                onClick={() => onFollowUp?.(text, i)}
                className="-mx-1.5 flex items-center gap-2 rounded-[7px] border-line border-b px-1.5 py-1.5 text-left text-[12.5px] text-ink transition-colors duration-100 hover:bg-hover-2"
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
      className="flex size-6 items-center justify-center rounded-[6px] text-ink-3 transition-colors duration-100 hover:bg-hover-2 hover:text-ink-2"
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
