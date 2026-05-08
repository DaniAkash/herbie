import type { ReactNode } from 'react'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

export type MaxWidth = 'max-w-2xl' | 'max-w-3xl' | 'max-w-5xl' | 'max-w-7xl'

export type PageHeaderProps = {
  maxWidth?: MaxWidth
  className?: string
  children: ReactNode
}

const widthScale: Record<MaxWidth, string> = {
  'max-w-2xl': 'max-w-2xl 2xl:max-w-3xl',
  'max-w-3xl': 'max-w-3xl 2xl:max-w-4xl',
  'max-w-5xl': 'max-w-5xl 2xl:max-w-6xl',
  'max-w-7xl': 'max-w-7xl',
}

export function PageHeader({
  maxWidth = 'max-w-3xl',
  className,
  children,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'electrobun-webkit-app-region-drag shrink-0 border-b bg-background/80 px-6 py-3 backdrop-blur',
      )}
    >
      <div
        className={cn(
          'mx-auto flex items-center gap-3',
          widthScale[maxWidth],
          className,
        )}
      >
        <SidebarTrigger className="md:hidden" />
        <Separator orientation="vertical" className="h-5 md:hidden" />
        {children}
      </div>
    </header>
  )
}

export type PageFooterProps = {
  maxWidth?: MaxWidth
  className?: string
  children: ReactNode
}

export function PageFooter({
  maxWidth = 'max-w-3xl',
  className,
  children,
}: PageFooterProps) {
  return (
    <footer className="electrobun-webkit-app-region-drag shrink-0 border-t bg-background/80 px-6 py-3 backdrop-blur">
      <div
        className={cn(
          'mx-auto flex items-center gap-2',
          widthScale[maxWidth],
          className,
        )}
      >
        {children}
      </div>
    </footer>
  )
}
