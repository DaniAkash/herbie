import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TABS = [
  { value: 'general', label: 'General', path: '/settings/general' },
  { value: 'agents', label: 'Agents', path: '/settings/agents' },
  { value: 'registry', label: 'Registry', path: '/settings/registry' },
  { value: 'skills', label: 'Skills', path: '/settings/skills' },
  { value: 'mobile', label: 'Mobile', path: '/settings/mobile' },
  { value: 'about', label: 'About', path: '/settings/about' },
] as const

type TabValue = (typeof TABS)[number]['value']

export function SettingsLayout() {
  const { pathname } = useLocation()
  // The URL is the source of truth for the active tab. The bare `/settings`
  // path is handled by the index route's `beforeLoad` redirect, so the
  // fallback to 'general' only ever covers transient mid-navigation states.
  const active: TabValue =
    (TABS.find((t) => pathname.startsWith(t.path))?.value as
      | TabValue
      | undefined) ?? 'general'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader maxWidth="max-w-3xl">
        <h1 className="font-semibold text-base tracking-tight">Settings</h1>
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {/* Tabs is controlled by the URL — `value` from useLocation,
              navigation happens through the <Link> rendered for each
              trigger. onValueChange is intentionally a no-op since the
              Link click drives the navigation. */}
          <Tabs value={active} onValueChange={noop}>
            <TabsList variant="line" className="mb-6 gap-4">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  render={<Link to={t.path} />}
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

function noop(): void {}
