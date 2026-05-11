import { PlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DynamicList({
  kind,
  rows,
  onAdd,
  onRemove,
  renderRow,
}: {
  kind: 'args' | 'env' | 'headers'
  rows: { id: string }[]
  onAdd: () => void
  onRemove: (idx: number) => void
  renderRow: (field: { id: string }, idx: number) => React.ReactNode
}) {
  const noun =
    kind === 'args' ? 'argument' : kind === 'env' ? 'variable' : 'header'
  return (
    <div className="flex flex-col gap-2">
      {rows.map((field, idx) => (
        <div key={field.id} className="flex items-center gap-2">
          {renderRow(field, idx)}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(idx)}
            aria-label={`Remove ${kind} entry`}
          >
            <XIcon />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAdd}
        className="self-start"
      >
        <PlusIcon data-icon="inline-start" />
        Add {noun}
      </Button>
    </div>
  )
}
