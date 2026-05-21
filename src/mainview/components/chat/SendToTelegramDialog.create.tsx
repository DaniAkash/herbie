import { ArrowLeftIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { ConversationSummary } from '@/modules/api/chat.hooks'

// Step 2: create a brand-new Special Purpose bot. Minimal form —
// just a token (and optionally a name); agent/model/workspace are
// inherited from the source conversation so the user doesn't repeat
// settings they already chose.
export function CreateBotStep({
  conv,
  isSubmitting,
  onBack,
  onSubmit,
}: {
  conv: ConversationSummary
  isSubmitting: boolean
  onBack: () => void
  onSubmit: (args: { name: string; botToken: string }) => Promise<void>
}) {
  const [name, setName] = useState(`Bot for ${conv.title.slice(0, 40)}`)
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)

  const canSubmit =
    name.trim().length > 0 && token.trim().length >= 20 && !isSubmitting

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    await onSubmit({ name: name.trim(), botToken: token.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="stt-bot-token">Bot token</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="stt-bot-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456:ABC-DEF…"
              className="flex-1 font-mono"
              autoComplete="off"
              autoFocus
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={showToken ? 'Hide token' : 'Show token'}
              onClick={() => setShowToken((v) => !v)}
            >
              {showToken ? <EyeOffIcon /> : <EyeIcon />}
            </Button>
          </div>
          <FieldDescription>
            Open <span className="font-mono">@BotFather</span> on Telegram, send{' '}
            <span className="font-mono">/newbot</span>, pick a name, and paste
            the token here.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="stt-bot-name">Bot name</FieldLabel>
          <Input
            id="stt-bot-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bot for this conversation"
          />
          <FieldDescription>
            Used in your Herbie settings only.
          </FieldDescription>
        </Field>

        <InheritedSettings conv={conv} />
      </FieldGroup>

      <div className="flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting ? 'Creating…' : 'Validate & Link'}
        </Button>
      </div>
    </form>
  )
}

// Informational card showing the 4-tuple that the new bot will
// inherit from the source conversation. Read-only; if the user wants
// different settings, they create the bot manually in Mobile settings.
function InheritedSettings({ conv }: { conv: ConversationSummary }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>Inherited from this conversation</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
          <dt className="text-muted-foreground">Agent</dt>
          <dd>{conv.agentId}</dd>
          <dt className="text-muted-foreground">Model</dt>
          <dd>{conv.modelId ?? 'agent default'}</dd>
          <dt className="text-muted-foreground">Workspace</dt>
          <dd className="truncate">{conv.workspacePath ?? '—'}</dd>
          <dt className="text-muted-foreground">Reasoning</dt>
          <dd>{conv.reasoningEffort ?? 'default'}</dd>
        </dl>
      </CardContent>
    </Card>
  )
}
