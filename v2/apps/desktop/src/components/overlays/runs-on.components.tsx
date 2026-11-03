import { CheckCircle2, Info, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent } from '@/components/motion/card'
import { RadioGroup } from '@/components/motion/radio'
import { RuntimeRow } from '@/components/overlays/new-agent.components'
import { needsSignIn } from '@/modules/api/runtimes.helpers'
import type { Runtime } from '@/modules/api/runtimes.hooks'

export function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 font-medium">{label}</span>
      {children}
    </div>
  )
}

/** What the runtime answered, in the words the row would use. */
export function ProbeLine({
  pending,
  runtime,
}: {
  pending: boolean
  runtime: Runtime | undefined
}) {
  if (pending) {
    return (
      <Note icon={<Loader2 size={14} className="animate-spin" />}>
        Asking it what it can do...
      </Note>
    )
  }
  if (!runtime?.probedAt) return null

  if (needsSignIn(runtime)) {
    return (
      <Note icon={<Info size={14} />}>
        It needs a sign in of its own before it can run anything.
      </Note>
    )
  }
  if (runtime.probeError) {
    return (
      <Note icon={<Info size={14} />}>
        It did not answer: {runtime.probeError}. It can still be used.
      </Note>
    )
  }
  if (runtime.modelValues.length === 0) {
    return (
      <Note icon={<Info size={14} />}>
        {runtime.displayName} has no model picker. It runs on whatever it is set
        to.
      </Note>
    )
  }
  return (
    <Note icon={<CheckCircle2 size={14} className="text-accent" />}>
      {runtime.displayName} answered:{' '}
      {count(runtime.modelValues.length, 'model')}
      {runtime.efforts.length > 0
        ? `, and effort in ${count(runtime.efforts.length, 'level')}`
        : ''}
      .
    </Note>
  )
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six']

function count(n: number, noun: string): string {
  const word = WORDS[n] ?? String(n)
  return `${word} ${noun}${n === 1 ? '' : 's'}`
}

function Note({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-ink-2">
      <span className="mt-[1px] shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  )
}

export function PickerSkeleton() {
  return (
    <div className="grid gap-1.5" aria-hidden="true">
      <div className="h-11 rounded-control bg-hover" />
      <div className="h-11 rounded-control bg-hover" />
      <div className="h-11 rounded-control bg-hover" />
    </div>
  )
}

/**
 * The runtime picker: a radio group, and the ones you would have to install.
 *
 * The uninstalled runtimes sit behind a disclosure rather than in the list.
 * acpx knows about thirty coding agents and a machine usually has two or
 * three, so they are a real answer to "what else is there" and a wall of
 * them is not an answer to "which one".
 */
export function RuntimePicker({
  runtimes,
  value,
  onSelect,
}: {
  runtimes: readonly Runtime[]
  value: string
  onSelect: (id: string) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const ready = runtimes.filter((r) => r.installState !== 'not-installed')
  const missing = runtimes.filter((r) => r.installState === 'not-installed')
  const shown = showAll ? runtimes : ready

  return (
    <>
      <Card
        variant="outlined"
        size="compact"
        className="!gap-0 !py-0 overflow-hidden"
      >
        <CardContent className="grid gap-0 p-0 py-1">
          <RadioGroup
            value={value}
            onValueChange={onSelect}
            aria-label="Runtime"
          >
            {shown.map((r) => (
              <RuntimeRow key={r.id} runtime={r} />
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
      {missing.length > 0 && !showAll ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 text-[12.5px] text-ink-3 hover:text-ink"
        >
          {ready.length === 0
            ? `None are installed. Show ${missing.length} Herbie can use`
            : `Show ${missing.length} more Herbie can use`}
        </button>
      ) : null}
    </>
  )
}
