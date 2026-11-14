import { useReducedMotion } from 'motion/react'
import { useId } from 'react'
import fallback from '@/assets/herbie-motion/static/squircle/idle.svg?raw'
import { steadyFace } from '@/components/agent/steady-face'
import { cn } from '@/lib/utils'

const HUE: Record<string, string> = {
  ops: 'var(--f-ops)',
  scout: 'var(--f-scout)',
  post: 'var(--f-post)',
  mail: 'var(--f-mail)',
  house: 'var(--f-house)',
  watch: 'var(--f-watch)',
}
const SIZE = { sm: 20, md: 28, lg: 54, xl: 40, preview: 96 } as const
const assets = import.meta.glob<string>(
  '../../assets/herbie-motion/{motion,static}/*/*.svg',
  { eager: true, query: '?raw', import: 'default' },
)
const shapes = new Set([
  'squircle',
  'circle',
  'soft-hexagon',
  'pill',
  'rounded-diamond',
  'soft-trapezoid',
  'rounded-arch',
])
type FaceState =
  | 'idle'
  | 'blink'
  | 'thinking'
  | 'input-needed'
  | 'error'
  | 'scheduled'
  | 'delighted'
  | 'surprised'
  | 'gentle-nod'
  | 'look-up'
  | 'look-down'
  | 'look-left'
  | 'look-right'

/** Locally bundled SVGs render as vectors, with IDs isolated per instance. */
export function AgentFace({
  color,
  shape = 'squircle',
  size = 'xl',
  state = 'idle',
  animate = false,
  off = false,
  className,
}: {
  color: string
  shape?: string
  size?: keyof typeof SIZE
  state?: FaceState
  animate?: boolean
  off?: boolean
  className?: string
}) {
  const id = useId().replaceAll(':', '')
  const reduce = useReducedMotion()
  const silhouette = shapes.has(shape) ? shape : 'squircle'
  const kind = animate && !reduce ? 'motion' : 'static'
  const expression =
    reduce &&
    (state === 'blink' ||
      state === 'delighted' ||
      state === 'surprised' ||
      state === 'gentle-nod' ||
      state.startsWith('look-'))
      ? 'idle'
      : state
  const source =
    assets[
      `../../assets/herbie-motion/${kind}/${silhouette}/${expression}.svg`
    ] ?? fallback
  // The bundled assets are trusted; IDs must be unique across faces.
  const svg = steadyFace(source)
    .replaceAll('id="face"', `id="face-${id}"`)
    .replaceAll('url(#face)', `url(#face-${id})`)
    .replaceAll('id="title"', `id="title-${id}"`)
    .replaceAll('id="desc"', `id="desc-${id}"`)
    .replace(
      'aria-labelledby="title desc"',
      `aria-labelledby="title-${id} desc-${id}"`,
    )
    .replaceAll('fill="#006239"', 'fill="currentColor"')
    // The pack's blink waits several seconds; a hover should respond promptly.
    .replaceAll(
      'keyTimes="0;0.67;0.70;0.73;0.78;0.81;0.84;1"',
      expression === 'blink'
        ? 'keyTimes="0;0.03;0.06;0.09;0.78;0.81;0.84;1"'
        : 'keyTimes="0;0.67;0.70;0.73;0.78;0.81;0.84;1"',
    )
  const px = SIZE[size]
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block shrink-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full',
        off && 'opacity-40 grayscale',
        className,
      )}
      style={{ width: px, height: px, color: HUE[color] ?? HUE.ops }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted bundled SVG with isolated IDs
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
