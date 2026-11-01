import { cn } from '@/lib/utils'

/** The six face colours, keyed the way the agents table stores them. */
const HUE: Record<string, string> = {
  ops: 'var(--f-ops)',
  scout: 'var(--f-scout)',
  post: 'var(--f-post)',
  mail: 'var(--f-mail)',
  house: 'var(--f-house)',
  watch: 'var(--f-watch)',
}

const SIZE = { sm: 20, md: 28, lg: 54, xl: 40 } as const

/**
 * The Herbie mascot, drawn bare in an agent's colour.
 *
 * No tile and no border: the shape itself is the agent, which is what makes a
 * row of them read as characters rather than as icons. The eyes are a dark
 * constant so they hold on any hue in either theme.
 *
 * `working` bobs. It is the only looping animation in the app, and it carries
 * real state rather than decorating.
 */
export function AgentFace({
  color,
  size = 'xl',
  working = false,
  off = false,
  className,
}: {
  color: string
  size?: keyof typeof SIZE
  working?: boolean
  off?: boolean
  className?: string
}) {
  const px = SIZE[size]
  return (
    <svg
      viewBox="55 56 402 350"
      width={px}
      height={px}
      aria-hidden="true"
      className={cn(
        'block shrink-0',
        working && 'motion-safe:animate-[herbie-bob_2.4s_ease-in-out_infinite]',
        off && 'opacity-40 grayscale',
        className,
      )}
      style={{ color: HUE[color] ?? HUE.ops }}
    >
      <g fill="currentColor">
        <path
          d="M256 144 L273.8 91.1"
          stroke="currentColor"
          strokeWidth="22"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="277.7" cy="80.4" r="19" />
        <rect x="67.3" y="225" width="26" height="86" rx="13" />
        <rect x="418.7" y="225" width="26" height="86" rx="13" />
        <rect x="92" y="140" width="328" height="256" rx="100" />
      </g>
      <circle cx="186" cy="282" r="48" fill="var(--eye)" />
      <circle cx="326" cy="282" r="48" fill="var(--eye)" />
    </svg>
  )
}
