import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Effort, as however many levels the runtime actually reports.
 *
 * A segment up to three and a select beyond: the claude adapter reports six,
 * and six segments in a narrow panel is a row of unreadable slivers.
 */
export function EffortControl({
  values,
  value,
  onChange,
  className,
}: {
  values: readonly string[]
  value: string
  onChange: (next: string) => void
  className?: string
}) {
  if (values.length <= 3) {
    return (
      <Tabs value={value} variant="segment" onValueChange={onChange}>
        <TabsList>
          {values.map((e) => (
            <TabsTrigger key={e} value={e}>
              {e}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    )
  }
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? 'w-[150px]'} aria-label="Effort">
        <SelectValue placeholder="Its default" />
      </SelectTrigger>
      <SelectContent>
        {values.map((e) => (
          <SelectItem key={e} value={e}>
            {e}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
