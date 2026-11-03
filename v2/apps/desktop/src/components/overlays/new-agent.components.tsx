import { Check, ChevronLeft } from 'lucide-react'
import { buttonVariants } from '@/components/atoms/Button'
import { RadioGroupItem } from '@/components/motion/radio'
import { cn } from '@/lib/utils'
import { needsSignIn } from '@/modules/api/runtimes.helpers'
import type { Runtime } from '@/modules/api/runtimes.hooks'

/** Which of the two steps you are on, and what the first one decided. */
export function Steps({ name }: { name?: string }) {
  const onSecond = Boolean(name)
  return (
    <div className="mb-4 flex items-center gap-2 text-[12.5px]">
      <Step n="1" current={!onSecond} done={onSecond}>
        {name || 'Who it is'}
      </Step>
      <span className="h-px flex-1 bg-line" />
      <Step n="2" current={onSecond}>
        How it runs
      </Step>
    </div>
  )
}

function Step({
  n,
  current,
  done = false,
  children,
}: {
  n: string
  current: boolean
  done?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      aria-current={current ? 'step' : undefined}
      className={cn(
        'flex min-w-0 items-center gap-1.5',
        current ? 'font-medium text-ink' : 'text-ink-3',
      )}
    >
      <span
        className={cn(
          'grid size-[17px] shrink-0 place-items-center rounded-full text-[10.5px] leading-none',
          current || done ? 'bg-ink text-canvas' : 'bg-hover-2 text-ink-3',
        )}
      >
        {done ? <Check size={9} strokeWidth={3} /> : n}
      </span>
      <span className="truncate">{children}</span>
    </span>
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className="-ml-1 inline-flex size-7 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-ink"
    >
      <ChevronLeft size={16} />
    </button>
  )
}

/**
 * What the row says underneath the name.
 *
 * Sign in comes first when we know about it, because it is the one reason a
 * runtime cannot be used that the person can do something about. The agent
 * count comes last: it is what makes a runtime familiar rather than what
 * makes it possible.
 */
function describeRuntime(runtime: Runtime): string {
  if (runtime.installState === 'not-installed') {
    return 'Not installed on this machine'
  }
  if (needsSignIn(runtime)) {
    return 'Needs a sign in before an agent can use it'
  }
  if (runtime.probeError) {
    return 'Did not answer when asked what it can do'
  }
  if (runtime.installState === 'npx-available') {
    return 'Will be fetched the first time it runs'
  }
  if (runtime.agentCount === 0) return 'Ready, no agents yet'
  if (runtime.agentCount === 1) return 'Ready, one agent uses it'
  return `Ready, ${runtime.agentCount} agents use it`
}

/**
 * One runtime to choose from.
 *
 * beui's radio item rather than a button of ours, so the group keeps arrow
 * key movement and a single tab stop without this file reimplementing either.
 *
 * A runtime that is not installed is still listed: the reason it cannot be
 * used is something the person can fix, and hiding it would make it look like
 * it was never an option. The link out is the honest limit of what the app
 * can do, since no CLI's sign in can be completed from in here.
 */
export function RuntimeRow({ runtime }: { runtime: Runtime }) {
  const usable = runtime.installState !== 'not-installed'
  const signIn = needsSignIn(runtime)

  return (
    <div className="flex items-center gap-2 px-1">
      <RadioGroupItem
        value={runtime.id}
        label={runtime.displayName}
        description={describeRuntime(runtime)}
        disabled={!usable}
        className="min-w-0 flex-1"
      />
      {(signIn || !usable) && runtime.installUrl ? (
        // The link wears the button's own classes rather than wrapping one:
        // a button inside an anchor is two controls over one target, and the
        // keyboard has to pick between them.
        <a
          href={runtime.installUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ size: 'xs', variant: 'secondary' })}
        >
          {signIn ? 'Sign in' : 'Install'}
        </a>
      ) : null}
    </div>
  )
}
