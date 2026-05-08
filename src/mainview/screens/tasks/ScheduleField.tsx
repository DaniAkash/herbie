import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { ScheduleConfig } from '@/modules/data/herbie-data.types'

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function timeOf(s: ScheduleConfig | undefined, fallback = '09:00') {
  if (s?.kind === 'daily' || s?.kind === 'weekly') {
    return `${pad(s.hour)}:${pad(s.minute)}`
  }
  return fallback
}

type Props = {
  value: ScheduleConfig
  onChange: (next: ScheduleConfig) => void
}

export function ScheduleField({ value, onChange }: Props) {
  const [kind, setKind] = useState<ScheduleConfig['kind']>(value.kind)
  const [dailyTime, setDailyTime] = useState(
    value.kind === 'daily' ? timeOf(value) : '09:00',
  )
  const [intervalHours, setIntervalHours] = useState<number>(
    value.kind === 'interval' ? value.hours : 4,
  )
  const [weeklyDay, setWeeklyDay] = useState<number>(
    value.kind === 'weekly' ? value.weekday : 1,
  )
  const [weeklyTime, setWeeklyTime] = useState<string>(
    value.kind === 'weekly' ? timeOf(value) : '09:00',
  )
  const [cron, setCron] = useState<string>(
    value.kind === 'cron' ? value.cron : '0 9 * * *',
  )

  useEffect(() => {
    if (kind === 'daily') {
      const [h, m] = dailyTime.split(':').map(Number)
      onChange({ kind: 'daily', hour: h ?? 9, minute: m ?? 0 })
      return
    }
    if (kind === 'interval') {
      onChange({ kind: 'interval', hours: Math.max(1, intervalHours) })
      return
    }
    if (kind === 'weekly') {
      const [h, m] = weeklyTime.split(':').map(Number)
      onChange({
        kind: 'weekly',
        weekday: weeklyDay,
        hour: h ?? 9,
        minute: m ?? 0,
      })
      return
    }
    onChange({ kind: 'cron', cron })
  }, [kind, dailyTime, intervalHours, weeklyDay, weeklyTime, cron, onChange])

  return (
    <div className="flex flex-col gap-2">
      <Label className="font-medium text-sm">Run</Label>
      <RadioGroup
        value={kind}
        onValueChange={(v) => setKind(v as ScheduleConfig['kind'])}
        className="flex flex-col gap-3"
      >
        <Row value="daily" current={kind} label="Every day at">
          <Input
            type="time"
            value={dailyTime}
            onChange={(e) => setDailyTime(e.target.value)}
            disabled={kind !== 'daily'}
            className="w-32"
          />
        </Row>
        <Row value="interval" current={kind} label="Every">
          <Input
            type="number"
            min={1}
            max={48}
            value={intervalHours}
            onChange={(e) => setIntervalHours(Number(e.target.value))}
            disabled={kind !== 'interval'}
            className="w-20"
          />
          <span className="text-muted-foreground text-sm">hours</span>
        </Row>
        <Row value="weekly" current={kind} label="Weekly on">
          <select
            value={weeklyDay}
            onChange={(e) => setWeeklyDay(Number(e.target.value))}
            disabled={kind !== 'weekly'}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground text-sm">at</span>
          <Input
            type="time"
            value={weeklyTime}
            onChange={(e) => setWeeklyTime(e.target.value)}
            disabled={kind !== 'weekly'}
            className="w-32"
          />
        </Row>
        <Row value="cron" current={kind} label="Custom cron">
          <Input
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            disabled={kind !== 'cron'}
            placeholder="0 9 * * *"
            className="w-48 font-mono"
          />
        </Row>
      </RadioGroup>
    </div>
  )
}

function Row({
  value,
  current,
  label,
  children,
}: {
  value: ScheduleConfig['kind']
  current: ScheduleConfig['kind']
  label: string
  children: React.ReactNode
}) {
  return (
    <Label
      htmlFor={`sched-${value}`}
      className="flex cursor-pointer items-center gap-3"
    >
      <RadioGroupItem value={value} id={`sched-${value}`} />
      <span
        className={
          current === value
            ? 'font-medium text-sm'
            : 'text-muted-foreground text-sm'
        }
      >
        {label}
      </span>
      {children}
    </Label>
  )
}
