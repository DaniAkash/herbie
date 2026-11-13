import { type SyntheticEvent, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Chevron,
  DiffChips,
  DiffPreview,
  diffPreviewAt,
  ToolStepRow,
} from '@/screens/conversation/blocks/tool-chips.components'
import type {
  DiffPreviewAt,
  ToolDiff,
  ToolDiffLine,
  ToolStep,
} from '@/screens/conversation/blocks/tool-chips.types'

/** How long each row waits before the next one appears. */
const STEP_MS = 700

/** An agent run as compact rows: the tool calls, then the files they edited. */
export function ToolChips({
  header,
  steps,
  diffs,
  diffLines,
  className,
}: {
  header: string
  steps: ToolStep[]
  diffs: ToolDiff[]
  diffLines: Record<string, ToolDiffLine[]>
  className?: string
}) {
  const [shown, setShown] = useState(0)
  const [open, setOpen] = useState(true)
  const [openRows, setOpenRows] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<DiffPreviewAt | null>(null)

  // Rows, then the diff chips as one more beat at the end.
  const total = steps.length + 1

  useEffect(() => {
    if (shown >= total) return
    const next = setTimeout(() => setShown((s) => s + 1), STEP_MS)
    return () => clearTimeout(next)
  }, [shown, total])

  const openPreview = (file: string) => (event: SyntheticEvent) => {
    const chip = (event.currentTarget as Element).closest('[data-diffchip]')
    if (!chip) return
    setPreview(diffPreviewAt(file, chip, diffLines[file]?.length ?? 0))
  }

  const closePreview = (file: string) => () =>
    setPreview((current) => (current?.file === file ? null : current))

  const toggleRow = (label: string) =>
    setOpenRows((current) => {
      const next = new Set(current)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })

  return (
    <div className={cn('w-full pb-1', className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="-mx-1.5 flex w-fit items-center gap-1.5 rounded-control px-1.5 py-1 text-[12.5px] text-ink-2 transition-colors duration-100 hover:bg-hover-2"
      >
        <Chevron
          open={open}
          size={12}
          className="transition-transform duration-200"
        />
        <span className="tabular-nums">{header}</span>
      </button>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          opacity: open ? 1 : 0,
        }}
      >
        {/* The negative inline margin plus padding keeps the content at the
            same x while giving the row hover pills room inside this clip box. */}
        <div className="-mx-1 overflow-hidden px-1.5 pb-1">
          <div className="mt-1.5 flex flex-col gap-1">
            {steps.slice(0, shown).map((step) => (
              <ToolStepRow
                key={step.label}
                step={step}
                open={openRows.has(step.label)}
                onToggle={() => toggleRow(step.label)}
              />
            ))}
          </div>

          {shown >= total && diffs.length > 0 ? (
            <DiffChips
              diffs={diffs}
              previewFile={preview?.file}
              onOpenPreview={openPreview}
              onClosePreview={closePreview}
            />
          ) : null}
        </div>
      </div>

      {preview ? (
        <DiffPreview
          at={preview}
          diff={diffs.find((diff) => diff.file === preview.file)}
          lines={diffLines[preview.file] ?? []}
        />
      ) : null}
    </div>
  )
}
