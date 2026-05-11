import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function PlaceholderTab({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-sm">{title}</h2>
      <div className="rounded-lg border border-dashed bg-card/40 p-10 text-center">
        <p className="mx-auto max-w-md text-muted-foreground text-sm leading-relaxed">
          {body}
        </p>
      </div>
    </section>
  )
}

export function MobileTab() {
  const [token, setToken] = useState('')
  const connected = false

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-sm">Telegram</h2>
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <span
            className={cn(
              'size-2 rounded-full',
              connected ? 'bg-emerald-500' : 'bg-muted-foreground/40',
            )}
            aria-hidden
          />
          <span className="font-medium text-sm">
            {connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="tg-token">Bot token</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="tg-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456:ABC-DEF…"
                className="flex-1 font-mono"
              />
              <Button disabled={!token}>Connect</Button>
            </div>
            <FieldDescription>
              Get a bot token from <span className="font-mono">@BotFather</span>{' '}
              on Telegram. Herbie reaches Telegram via outbound polling — no
              public URL required.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </div>
    </section>
  )
}

export function AboutTab() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-sm">About</h2>
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-2 font-semibold">Herbie</div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          A lightweight 24×7 menubar AI assistant. Routes prompts to the right
          coding agent, runs scheduled tasks, and bridges to your phone via
          Telegram.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Version</div>
            <div className="font-mono">0.0.1</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Data folder</div>
            <div className="font-mono">~/.herbie</div>
          </div>
        </div>
      </div>
    </section>
  )
}
