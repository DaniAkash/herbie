import { Card, CardContent } from '@/components/motion/card'

/**
 * A labelled group of rows.
 *
 * beui's Card in its outlined variant holds the group, so the panel and the
 * overlays share one surface rather than each inventing hairlines.
 */
export function PanelSection({
  label,
  note,
  children,
}: {
  label?: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-6">
      {label ? (
        <div className="mb-2 font-medium text-[13px] text-ink-3">{label}</div>
      ) : null}
      {/*
        The card is the surface, not the spacing. Its own size adds 24px of
        vertical padding and a 24px gap between children, which stacks on the
        padding each row already carries and leaves the panel mostly air.
      */}
      <Card
        variant="outlined"
        size="compact"
        className="!gap-0 !py-0 overflow-hidden"
      >
        <CardContent className="grid gap-0 p-0 [&>*+*]:border-line [&>*+*]:border-t">
          {children}
        </CardContent>
      </Card>
      {note ? <p className="mt-2 text-[12.5px] text-ink-2">{note}</p> : null}
    </section>
  )
}

/** One row: a label, an optional caption, and a control on the right. */
export function PanelRow({
  k,
  v,
  children,
}: {
  k: React.ReactNode
  v?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{k}</span>
        {v ? (
          <span className="mt-0.5 block text-[12.5px] text-ink-2">{v}</span>
        ) : null}
      </span>
      {children}
    </div>
  )
}
