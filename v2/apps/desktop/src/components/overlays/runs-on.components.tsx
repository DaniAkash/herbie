import { useState } from 'react'
import { Controller } from 'react-hook-form'
import { CircleCheckBig } from '@/components/animate-ui/icons/circle-check-big'
import { Info } from '@/components/animate-ui/icons/info'
import { LoaderCircle } from '@/components/animate-ui/icons/loader-circle'
import { TextField } from '@/components/form/TextField'
import { Button } from '@/components/ui/button'
import { shortenHome } from '@/lib/paths'
import type { AgentForm } from '@/modules/api/forms'
import { needsSignIn } from '@/modules/api/runtimes.helpers'
import type { Runtime } from '@/modules/api/runtimes.hooks'
import { chooseFolder, parentOf } from '@/modules/host/folder'
import { isDesktop } from '@/modules/host/host'

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
      <Note icon={<LoaderCircle size={14} animate loop />}>
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
    <Note icon={<CircleCheckBig size={14} className="text-accent" />}>
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

export function Note({
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

/** The folder row, and what it is for. */
export function FolderSection({
  form,
  planned,
}: {
  form: AgentForm
  planned: string | undefined
}) {
  return (
    <section>
      <div className="mb-2 font-medium text-[13px] text-ink-3">
        Its own folder
      </div>
      <Controller
        control={form.control}
        name="workspaceDir"
        render={({ field }) => (
          <FolderField
            value={field.value ?? null}
            planned={planned}
            onChange={field.onChange}
          />
        )}
      />
      <p className="mt-2 text-[12.5px] text-ink-2">
        Made fresh, so two agents editing the same repository never fight over
        one working tree.
      </p>
    </section>
  )
}

/**
 * The folder the agent will work in.
 *
 * The draft holds nothing until a folder is actually chosen, so the path on
 * screen is the one the sidecar says this name would get and the server keeps
 * deciding it. Typing a path is the web page's version of the same control:
 * there is no OS dialog to open there.
 */
function FolderField({
  value,
  planned,
  onChange,
}: {
  value: string | null
  planned: string | undefined
  onChange: (next: string | null) => void
}) {
  const [asking, setAsking] = useState(false)

  if (!isDesktop()) {
    return (
      <TextField
        value={value ?? ''}
        onChange={(next) => onChange(next || null)}
        placeholder={
          planned ? shortenHome(planned) : 'Made for it under the agents folder'
        }
        className="font-mono text-[12.5px]"
      />
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate rounded-control bg-hover px-2.5 py-2 font-mono text-[12.5px] text-ink-2">
        {shortenHome(value ?? planned ?? '')}
      </span>
      <Button
        size="xs"
        variant="secondary"
        type="button"
        disabled={asking}
        onClick={async () => {
          setAsking(true)
          try {
            const picked = await chooseFolder(parentOf(value ?? planned ?? ''))
            if (picked) onChange(picked)
          } finally {
            setAsking(false)
          }
        }}
      >
        Choose
      </Button>
      {value ? (
        <Button
          size="xs"
          variant="ghost"
          type="button"
          onClick={() => onChange(null)}
        >
          Default
        </Button>
      ) : null}
    </div>
  )
}
