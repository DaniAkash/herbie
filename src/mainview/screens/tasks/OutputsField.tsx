import { InboxIcon, SendIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Field, FieldLabel } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Outputs section in the task editor. Inbox is always-on (no toggle).
// Telegram renders as a permanently-disabled "Coming soon" toggle —
// the feature is on the roadmap but isn't wired yet, so we surface
// the affordance without letting the user configure something that
// won't work.
export function OutputsField() {
  return (
    <Field>
      <FieldLabel>Outputs</FieldLabel>
      <div className="flex flex-col gap-1 divide-y divide-border rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-start gap-3">
            <InboxIcon className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <div className="font-medium text-sm">Inbox</div>
              <div className="text-muted-foreground text-xs">
                Results always land as a card in your Herbie inbox.
              </div>
            </div>
          </div>
          <Switch checked disabled aria-readonly />
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <div className="flex cursor-not-allowed items-center justify-between gap-4 px-5 py-4 opacity-60">
                <div className="flex items-start gap-3">
                  <SendIcon className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2 font-medium text-sm">
                      Telegram
                      <Badge variant="outline" className="text-[9px]">
                        Coming soon
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Send each result to your bound Telegram chat.
                    </div>
                  </div>
                </div>
                <Switch checked={false} disabled aria-readonly />
              </div>
            }
          />
          <TooltipContent>
            Telegram delivery is in the works — track it on the roadmap.
          </TooltipContent>
        </Tooltip>
      </div>
    </Field>
  )
}
