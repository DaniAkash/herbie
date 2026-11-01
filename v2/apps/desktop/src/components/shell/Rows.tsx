/** A labelled group of hairline separated rows. */
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
      <div className="grid [&>*+*]:border-line [&>*+*]:border-t">
        {children}
      </div>
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
    <div className="flex items-center gap-3 px-0.5 py-3">
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
