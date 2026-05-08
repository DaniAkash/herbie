import type { AgentId } from '@/modules/data/herbie-data.types'

type ChatHeaderProps = {
  title: string
  agent: AgentId
  workspaceLabel: string
}

export function ChatHeader({ title, agent, workspaceLabel }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-border border-b bg-background/95 px-6 py-3 backdrop-blur">
      <h1 className="truncate font-semibold text-base">{title}</h1>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
          {agent}
        </span>
        <span>·</span>
        <span>{workspaceLabel}</span>
      </div>
    </header>
  )
}
