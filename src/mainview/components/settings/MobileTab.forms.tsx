import { EyeIcon, EyeOffIcon, TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useWorkspaces } from '@/modules/api/settings.hooks'
import {
  useCreateTelegramConnection,
  useWorkspaceInUse,
} from '@/modules/api/telegram.hooks'
import type { AgentId } from '@/modules/data/herbie-data.types'
import {
  AgentSelect,
  ModelSelect,
  ReasoningSelect,
  WorkspaceSelect,
} from './MobileTab.pickers'

export function AddConnectionForm({ onDone }: { onDone: () => void }) {
  const create = useCreateTelegramConnection()
  const { defaultPath } = useWorkspaces()
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [agentId, setAgentId] = useState<AgentId>('claude')
  const [modelId, setModelId] = useState<string | null>(null)
  const [reasoning, setReasoning] = useState<string | null>(null)
  const [workspacePath, setWorkspacePath] = useState<string | null>(null)

  const effectiveWorkspace = workspacePath ?? defaultPath
  const workspaceCheck = useWorkspaceInUse({
    variables: { path: effectiveWorkspace ?? '' },
    enabled: !!effectiveWorkspace,
  })
  const dupConnection = workspaceCheck.data?.inUseBy ?? null

  const canSubmit =
    name.trim().length > 0 &&
    token.trim().length >= 20 &&
    !!effectiveWorkspace &&
    !create.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!effectiveWorkspace) return
    try {
      await create.mutateAsync({
        name: name.trim(),
        botToken: token.trim(),
        agentId,
        modelId: modelId ?? null,
        workspacePath: effectiveWorkspace,
        reasoningEffort: reasoning ?? null,
      })
      toast.success('Bot connected', {
        description:
          'Send /start to your bot in Telegram to confirm it’s live.',
      })
      onDone()
    } catch {
      // toastApiError on the mutation surfaces the message
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Add Telegram connection</DialogTitle>
        <DialogDescription>
          The bot will use the agent + workspace you pick here for every chat it
          receives. You can't change these later — delete and recreate the
          connection if you need different settings.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="tg-name">Name</FieldLabel>
          <Input
            id="tg-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Personal bot"
            autoFocus
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="tg-token">Bot token</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="tg-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456:ABC-DEF…"
              className="flex-1 font-mono"
              autoComplete="off"
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
            Create a bot with <span className="font-mono">@BotFather</span> on
            Telegram and paste the token here.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Agent</FieldLabel>
          <AgentSelect
            value={agentId}
            onChange={(next) => {
              setAgentId(next)
              setModelId(null)
              setReasoning(null)
            }}
          />
        </Field>

        <Field>
          <FieldLabel>Model</FieldLabel>
          <ModelSelect
            agentId={agentId}
            value={modelId}
            onChange={setModelId}
          />
        </Field>

        <Field>
          <FieldLabel>Workspace</FieldLabel>
          <WorkspaceSelect
            value={workspacePath}
            defaultPath={defaultPath}
            onChange={setWorkspacePath}
          />
          {effectiveWorkspace && <WorkspaceWarning path={effectiveWorkspace} />}
          {dupConnection && (
            <DuplicateWorkspaceWarning otherName={dupConnection.name} />
          )}
        </Field>

        <Field>
          <FieldLabel>Reasoning</FieldLabel>
          <ReasoningSelect
            agentId={agentId}
            value={reasoning}
            onChange={setReasoning}
          />
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {create.isPending ? 'Connecting…' : 'Add connection'}
        </Button>
      </div>
    </form>
  )
}

function WorkspaceWarning({ path }: { path: string }) {
  return (
    <FieldDescription>
      <span className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 leading-snug dark:text-amber-300">
        <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
        <span>
          This bot can read &amp; edit files in{' '}
          <span className="font-mono">{path}</span>.
        </span>
      </span>
    </FieldDescription>
  )
}

function DuplicateWorkspaceWarning({ otherName }: { otherName: string }) {
  return (
    <FieldDescription>
      <span className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 leading-snug dark:text-amber-300">
        <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <span className="font-medium">{otherName}</span> already uses this
          workspace. Two bots running in the same folder can produce conflicting
          edits.
        </span>
      </span>
    </FieldDescription>
  )
}
