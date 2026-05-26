import type { PermissionMode } from '@/components/chat/composer.types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  type ThemeMode,
  useSettings,
  useUpdateSettings,
} from '@/modules/api/settings.hooks'

const PERMISSION_LABELS: Record<PermissionMode, string> = {
  'auto-approve-reads': 'Auto-approve reads',
  manual: 'Approve each request',
  'read-only': 'Read-only',
  'allow-all': 'Allow everything',
}

const PERMISSION_DESCRIPTIONS: Record<PermissionMode, string> = {
  'auto-approve-reads': 'Reads pass; writes & shell prompt you',
  manual: 'Every gate prompts you',
  'read-only': 'Reads pass; writes & shell auto-denied',
  'allow-all': 'Agent runs unattended — use with care',
}

export function GeneralTab() {
  const { data, isLoading } = useSettings()
  const { mutate } = useUpdateSettings()

  if (isLoading || !data) {
    return <Skeleton className="h-40 rounded-lg" />
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-sm">Appearance</h2>
        <ToggleGroup
          value={[data.appearance.theme]}
          onValueChange={(v: string[]) =>
            v[0] && mutate({ appearance: { theme: v[0] as ThemeMode } })
          }
          variant="outline"
        >
          <ToggleGroupItem value="light" aria-label="Light">
            Light
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" aria-label="Dark">
            Dark
          </ToggleGroupItem>
          <ToggleGroupItem value="system" aria-label="System">
            System
          </ToggleGroupItem>
        </ToggleGroup>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-sm">Application</h2>
        <div className="divide-y divide-border rounded-lg border bg-card">
          <SettingRow
            label="Launch at login"
            description="Open Herbie automatically when you log in to your Mac."
            checked={data.general.launchAtLogin}
            onChange={(v) => mutate({ general: { launchAtLogin: v } })}
          />
          <SettingRow
            label="Keep in menu bar on close"
            description="When the window is closed, hide it instead of quitting. Reach Herbie again via the menu bar icon."
            checked={data.general.minimizeToMenubarOnClose}
            onChange={(v) =>
              mutate({ general: { minimizeToMenubarOnClose: v } })
            }
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-sm">Conversation defaults</h2>
        <div className="rounded-lg border bg-card">
          <div className="flex flex-col gap-2 px-5 py-4">
            <div className="font-medium text-sm">
              Default permission for new conversations
            </div>
            <p className="text-muted-foreground text-xs">
              Applied when a new chat is created. Existing chats keep whatever
              they were started with.
            </p>
            <Select
              value={data.general.defaultPermissionMode}
              onValueChange={(v) => {
                if (!v) return
                mutate({
                  general: { defaultPermissionMode: v as PermissionMode },
                })
              }}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERMISSION_LABELS) as PermissionMode[]).map(
                  (mode) => (
                    <SelectItem key={mode} value={mode}>
                      <div className="flex flex-col">
                        <span>{PERMISSION_LABELS[mode]}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {PERMISSION_DESCRIPTIONS[mode]}
                        </span>
                      </div>
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
    </div>
  )
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-muted-foreground text-xs">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
