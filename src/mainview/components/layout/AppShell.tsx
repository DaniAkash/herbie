import type { CSSProperties, ReactNode } from 'react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { SidebarResizeHandle, useSidebarWidth } from './SidebarResize'

export function AppShell({ children }: { children: ReactNode }) {
  const { widthPx, onResizeStart } = useSidebarWidth()

  return (
    <SidebarProvider
      className="h-full"
      style={
        {
          // Override the shadcn primitive's default `--sidebar-width: 16rem`.
          // Updated live as the user drags; persisted to localStorage on
          // pointer-up.
          '--sidebar-width': `${widthPx}px`,
        } as CSSProperties
      }
    >
      <div className="relative">
        <AppSidebar />
        <SidebarResizeHandle onPointerDown={onResizeStart} />
      </div>
      <SidebarInset className="overflow-hidden">{children}</SidebarInset>
    </SidebarProvider>
  )
}
