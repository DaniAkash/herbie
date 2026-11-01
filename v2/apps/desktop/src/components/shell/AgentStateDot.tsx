import { cn } from '@/lib/utils'

/**
 * Only real state gets a colour. working breathes, stuck is red, and
 * everything else renders nothing rather than a decorative dot.
 */
export function AgentStateDot({ state }: { state: string }) {
  if (state !== 'working' && state !== 'stuck') return null
  return (
    <span
      className={cn(
        'size-1.5 shrink-0 rounded-full',
        state === 'working' &&
          'bg-accent motion-safe:animate-[herbie-fade_1.8s_ease-in-out_infinite]',
        state === 'stuck' && 'bg-red',
      )}
    />
  )
}
