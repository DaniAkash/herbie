import { cn } from '@/lib/utils'
import type { AgentId } from '@/modules/data/herbie-data.types'

export const AGENT_LABELS: Record<AgentId, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
  hermes: 'Hermes',
}

export const AGENT_IDS: AgentId[] = ['claude', 'codex', 'gemini', 'hermes']

// Shared little 2-column row used in both the connection card and
// the read-only "pinned at creation" block inside the edit form.
export function DetailRow({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: string
  mono?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span
        className={cn(
          'truncate text-[12px]',
          mono ? 'font-mono text-muted-foreground' : '',
        )}
      >
        {value}
      </span>
    </div>
  )
}
