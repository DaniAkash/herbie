import type { ReactNode } from 'react'

export function StatCard({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 rounded-card bg-surface p-4 shadow-card">
      <span className="font-medium text-[12px] text-ink-3 uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="font-semibold text-[20px] text-ink">{children}</span>
    </div>
  )
}
