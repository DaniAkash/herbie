import type { ReactNode, SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type {
  DiffPreviewAt,
  ToolDiff,
  ToolDiffLine,
  ToolStep,
} from '@/screens/conversation/blocks/tool-chips.types'

const ICONS: Record<string, ReactNode> = {
  think: <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />,
  write: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
    </g>
  ),
  run: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 17l6-5-6-5M12 19h8" />
    </g>
  ),
  read: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </g>
  ),
}

export function Chevron({
  open,
  size,
  className,
}: {
  open: boolean
  size: number
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/**
 * One tool call. The step's own glyph gives way to a chevron on hover or once
 * the row is open, so the affordance appears only where it applies.
 */
export function ToolStepRow({
  step,
  open,
  onToggle,
}: {
  step: ToolStep
  open: boolean
  onToggle: () => void
}) {
  return (
    <div
      style={{ animation: 'fade-up 300ms cubic-bezier(0.23,1,0.32,1) both' }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="group/row -mx-[3px] flex h-7 w-[calc(100%+6px)] min-w-0 items-center gap-2 rounded-control px-[3px] text-left transition-colors duration-100 hover:bg-hover-2"
      >
        <span className="relative flex size-4 shrink-0 items-center justify-center text-ink-3">
          <svg
            aria-hidden="true"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={step.icon === 'think' ? 'currentColor' : 'none'}
            stroke="currentColor"
            className={cn(
              'transition-opacity duration-100 group-hover/row:opacity-0',
              open && 'opacity-0',
            )}
          >
            {ICONS[step.icon]}
          </svg>
          <Chevron
            open={open}
            size={12}
            className={cn(
              'absolute transition-[opacity,transform] duration-150 group-hover/row:opacity-100',
              open ? 'opacity-100' : 'opacity-0',
            )}
          />
        </span>
        <span className="shrink-0 font-medium text-[12.5px] text-ink">
          {step.label}
        </span>
        <span
          className={cn(
            'inline-flex h-5.5 min-w-0 flex-1 cursor-pointer items-center truncate rounded-chip bg-field px-1.5 text-[11.5px] text-ink-2 shadow-hairline transition-colors duration-100 hover:bg-hover-2',
            step.mono && 'font-mono',
          )}
        >
          {step.chip}
        </span>
      </button>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          opacity: open ? 1 : 0,
          transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-0.5 mb-1 ml-2 flex flex-col gap-0.5 border-line border-l py-0.5 pl-3.5">
            {step.detail.map((line) => (
              <span
                key={line.text}
                className={cn(
                  'truncate text-[11.5px] leading-[1.6]',
                  step.detailMono && 'font-mono',
                  line.tone === 'add' ? 'text-green' : 'text-ink-2',
                )}
              >
                {line.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Height of the preview card's header plus one line, used to pick a side. */
const PREVIEW_HEADER = 38
const PREVIEW_LINE = 19
const PREVIEW_WIDTH = 300
const VIEWPORT_MARGIN = 12

export function diffPreviewAt(
  file: string,
  chip: Element,
  lines: number,
): DiffPreviewAt {
  const rect = chip.getBoundingClientRect()
  const height = PREVIEW_HEADER + lines * PREVIEW_LINE
  const fitsBelow =
    rect.bottom + 6 + height <= window.innerHeight - VIEWPORT_MARGIN
  return {
    file,
    x: Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, window.innerWidth - PREVIEW_WIDTH),
    ),
    ...(fitsBelow
      ? { top: rect.bottom + 6 }
      : { bottom: window.innerHeight - rect.top + 6 }),
  }
}

export function DiffChips({
  diffs,
  previewFile,
  onOpenPreview,
  onClosePreview,
}: {
  diffs: ToolDiff[]
  previewFile: string | undefined
  onOpenPreview: (file: string) => (event: SyntheticEvent) => void
  onClosePreview: (file: string) => () => void
}) {
  return (
    <div className="mt-2.5 flex max-w-full flex-wrap gap-1.5 border-line border-t pt-2.5">
      {diffs.map((diff, i) => (
        <button
          key={diff.file}
          type="button"
          data-diffchip
          aria-expanded={previewFile === diff.file}
          aria-label={`Show diff for ${diff.file}`}
          onMouseEnter={onOpenPreview(diff.file)}
          onMouseLeave={onClosePreview(diff.file)}
          onFocus={onOpenPreview(diff.file)}
          onBlur={onClosePreview(diff.file)}
          className="inline-flex h-7 max-w-full items-center gap-2 rounded-chip bg-surface px-2 font-mono text-[11.5px] text-ink shadow-btn transition-colors duration-100 hover:bg-hover"
          style={{
            animation: `pop-in 250ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms both`,
          }}
        >
          <span className="min-w-0 truncate">{diff.file}</span>
          <span className="shrink-0 text-green tabular-nums">+{diff.add}</span>
          {diff.del > 0 ? (
            <span className="shrink-0 text-red tabular-nums">−{diff.del}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

/**
 * Rendered into the body so that an animated or translated reply wrapper
 * cannot redefine the fixed-position coordinate system under it.
 */
export function DiffPreview({
  at,
  diff,
  lines,
}: {
  at: DiffPreviewAt
  diff: ToolDiff | undefined
  lines: ToolDiffLine[]
}) {
  if (typeof document === 'undefined') return null

  const keyed = lines.map((line, i) => ({ at: `${i}:${line.text}`, line }))

  return createPortal(
    <div
      className="fixed z-50 w-72 overflow-hidden rounded-[10px] bg-surface shadow-overlay"
      style={{
        left: at.x,
        top: at.top,
        bottom: at.bottom,
        animation: 'pop-in 160ms cubic-bezier(0.23,1,0.32,1) both',
        transformOrigin: at.top === undefined ? 'bottom left' : 'top left',
      }}
    >
      <div className="flex items-center justify-between border-line border-b px-2.5 py-1.5 font-mono text-[11px]">
        <span className="min-w-0 truncate text-ink-2">{at.file}</span>
        <span className="shrink-0 tabular-nums">
          <span className="text-green">+{diff?.add}</span>
          {(diff?.del ?? 0) > 0 ? (
            <span className="text-red"> −{diff?.del}</span>
          ) : null}
        </span>
      </div>
      <div className="py-1 font-mono text-[11px] leading-[1.8]">
        {keyed.map(({ at: key, line }) => (
          <div
            key={key}
            className={cn(
              'flex gap-2 whitespace-pre px-2.5',
              line.tone === 'add' && 'bg-green-tint text-green',
              line.tone === 'del' && 'bg-red-tint text-red',
              line.tone === 'ctx' && 'text-ink-2',
            )}
          >
            <span className="w-3 shrink-0 select-none">
              {line.tone === 'add' ? '+' : line.tone === 'del' ? '−' : ' '}
            </span>
            <span className="min-w-0 truncate">{line.text}</span>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}
