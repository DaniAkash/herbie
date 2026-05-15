import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAgentDisplayName } from '@/modules/api/agents.hooks'
import {
  type TelegramConnection,
  useUpdateTelegramConnection,
} from '@/modules/api/telegram.hooks'
import { DetailRow } from './mobile-tab.constants'

export function EditConnectionForm({
  connection,
  onDone,
}: {
  connection: TelegramConnection
  onDone: () => void
}) {
  const update = useUpdateTelegramConnection()
  const [name, setName] = useState(connection.name)
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const agentLabel = useAgentDisplayName(connection.agentId)

  // Reset draft fields if the user opens a different connection
  // without unmounting (Dialog stays mounted while the menu reopens).
  useEffect(() => {
    setName(connection.name)
    setToken('')
    setShowToken(false)
  }, [connection.name])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await update.mutateAsync({
        id: connection.id,
        name: name.trim() === connection.name ? undefined : name.trim(),
        botToken: token.trim() ? token.trim() : undefined,
      })
      toast.success('Connection updated')
      onDone()
    } catch {
      // toastApiError on the mutation surfaces the message
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Edit connection</DialogTitle>
        <DialogDescription>
          Only the name and bot token can change. Delete and recreate the
          connection if you need to switch agents or workspaces.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="tg-edit-name">Name</FieldLabel>
          <Input
            id="tg-edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="tg-edit-token">Bot token</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="tg-edit-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Leave blank to keep current"
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
        </Field>

        <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px]">
          <div className="mb-1 text-muted-foreground uppercase tracking-wider">
            Pinned at creation
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DetailRow label="Agent" value={agentLabel} />
            <DetailRow
              label="Model"
              value={connection.modelId ?? 'agent default'}
              mono
            />
            <DetailRow
              label="Workspace"
              value={connection.workspacePath}
              mono
              className="col-span-2"
            />
          </div>
        </div>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            update.isPending ||
            (name.trim() === connection.name && token.trim().length === 0)
          }
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
