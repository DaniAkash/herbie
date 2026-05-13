export function PlaceholderTab({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-sm">{title}</h2>
      <div className="rounded-lg border border-dashed bg-card/40 p-10 text-center">
        <p className="mx-auto max-w-md text-muted-foreground text-sm leading-relaxed">
          {body}
        </p>
      </div>
    </section>
  )
}

export function AboutTab() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-sm">About</h2>
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-2 font-semibold">Herbie</div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          A lightweight 24×7 menubar AI assistant. Routes prompts to the right
          coding agent, runs scheduled tasks, and bridges to your phone via
          Telegram.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Version</div>
            <div className="font-mono">0.0.1</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Data folder</div>
            <div className="font-mono">~/.herbie</div>
          </div>
        </div>
      </div>
    </section>
  )
}
