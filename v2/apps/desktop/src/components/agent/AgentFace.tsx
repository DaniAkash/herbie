import { useReducedMotion } from 'motion/react'
import { useId } from 'react'
import fallback from '@/assets/herbie-motion/static/squircle/idle.svg?raw'
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
  const source =
    assets[`../../assets/herbie-motion/${kind}/${silhouette}/${state}.svg`] ??
    fallback
  // The bundled assets are trusted; IDs must be unique across faces.
  const svg = source
    .replaceAll('id="face"', `id="face-${id}"`)
    .replaceAll('url(#face)', `url(#face-${id})`)
    .replaceAll('id="title"', `id="title-${id}"`)
    .replaceAll('id="desc"', `id="desc-${id}"`)
    .replace(
      'aria-labelledby="title desc"',
      `aria-labelledby="title-${id} desc-${id}"`,
    )
    .replace(
      '<defs>',
      `<defs><linearGradient id="color-${id}" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="color-mix(in srgb, currentColor 72%, white)"/><stop offset="0.48" stop-color="currentColor"/><stop offset="1" stop-color="color-mix(in srgb, currentColor 72%, black)"/></linearGradient><radialGradient id="shine-${id}" cx="30%" cy="28%" r="55%" gradientTransform="translate(0 .12) scale(1 .65)"><stop offset="0" stop-color="white" stop-opacity=".58"/><stop offset=".42" stop-color="white" stop-opacity=".18"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>`,
    )
    .replaceAll(
      `<rect width="512" height="512" fill="#006239" mask="url(#face-${id})"/>`,
      `<rect width="512" height="512" fill="url(#color-${id})" mask="url(#face-${id})"/><rect width="512" height="512" fill="url(#shine-${id})" mask="url(#face-${id})"/>`,
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
