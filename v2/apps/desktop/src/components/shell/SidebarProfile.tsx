import { useState } from 'react'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/motion/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

const PROFILE_KEY = 'herbie-profile-name'

function readName() {
  try {
    return localStorage.getItem(PROFILE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function SidebarProfile() {
  const [name, setName] = useState(readName)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  const edit = () => {
    setDraft(name)
    setError('')
    setOpen(true)
  }
  const save = () => {
    const value = draft.trim()
    if (!value) {
      setError('Enter your name.')
      return
    }
    try {
      localStorage.setItem(PROFILE_KEY, value)
    } catch {
      setError('Could not save your name on this device.')
      return
    }
    setName(value)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className="flex min-w-0 items-center gap-2 rounded-control text-left hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        title="Double-click to edit your name"
        aria-label={`Edit profile${name ? ` for ${name}` : ''}`}
        onDoubleClick={edit}
        onClick={(event) => {
          if (event.detail === 0) edit()
        }}
      >
        <span className="grid size-[23px] shrink-0 place-items-center rounded-full bg-hover-2 font-medium text-[10px] text-ink-2">
          {initials || '?'}
        </span>
        <span className="truncate font-medium text-[13.5px]">
          {name || 'Your name'}
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Choose the name shown in your sidebar.
          </DialogDescription>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <Input
              label="Name"
              value={draft}
              onChange={(value) => {
                setDraft(value)
                setError('')
              }}
              maxLength={60}
              error={error || undefined}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="quiet"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="primary">
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
