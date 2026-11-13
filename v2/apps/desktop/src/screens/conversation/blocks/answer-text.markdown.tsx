import type { ReactNode } from 'react'
import type { Components } from 'streamdown'
import { webHref } from '@/screens/conversation/blocks/answer-text.helpers'

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

export const MARKDOWN: Components = {
  p: ({ children }: Slot) => <p className="my-1.5">{children}</p>,
  h1: ({ children }: Slot) => (
    <h1 className="mt-4 mb-1.5 font-semibold text-[16px]">{children}</h1>
  ),
  h2: ({ children }: Slot) => (
    <h2 className="mt-4 mb-1.5 font-semibold text-[14.5px]">{children}</h2>
  ),
  h3: ({ children }: Slot) => (
    <h3 className="mt-3 mb-1 font-semibold text-[13.5px]">{children}</h3>
  ),
  h4: ({ children }: Slot) => (
    <h4 className="mt-3 mb-1 font-semibold text-[13px] text-ink-2">
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
    <pre className="my-2 overflow-x-auto rounded-[8px] bg-inset p-2.5 font-mono text-[12px] text-ink-2 leading-[1.55] shadow-hairline [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[12px]">
      {children}
    </pre>
  ),
  blockquote: ({ children }: Slot) => (
    <blockquote className="my-2 border-line border-l-2 pl-2.5 text-ink-2">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-0 border-line border-t" />,
  table: ({ children }: Slot) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }: Slot) => (
    <th className="border-line border-b pr-3 pb-1 font-medium">{children}</th>
  ),
  td: ({ children }: Slot) => (
    <td className="border-line border-b py-1 pr-3 align-top text-ink-2">
      {children}
    </td>
  ),
}
