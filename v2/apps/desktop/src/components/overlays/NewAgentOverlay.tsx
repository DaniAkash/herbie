import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { AgentFace } from '@/components/agent/AgentFace'
import { Button } from '@/components/atoms/Button'
import { Input } from '@/components/motion/input'
import { Overlay } from '@/components/shell/Overlay'
import { cn } from '@/lib/utils'
import { closeOverlay } from '@/modules/navigation/overlay'

const COLORS = ['ops', 'scout', 'post', 'mail', 'house', 'watch'] as const

/** Four things: a face, a name, a colour, and what it should do. */
export function NewAgentOverlay() {
  const [color, setColor] = useState<string>('house')

  return (
    <Overlay
      narrow
      title="New agent"
      footer={
        <>
          <Link to="." search={closeOverlay}>
            <Button size="sm" variant="quiet">
              Cancel
            </Button>
          </Link>
          <Link to="." search={closeOverlay}>
            <Button size="sm" variant="primary">
              Create
            </Button>
          </Link>
        </>
      }
    >
      <div className="grid justify-items-center gap-4">
        <AgentFace color={color} size="lg" />
        <Input placeholder="Give it a name" className="text-center" />
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={c === color}
              onClick={() => setColor(c)}
              style={{ background: `var(--f-${c})` }}
              className={cn(
                'size-[22px] rounded-full transition-transform duration-150 ease-out hover:scale-110',
                c === color && 'ring-2 ring-surface ring-offset-2',
              )}
            />
          ))}
        </div>
        <textarea
          placeholder="What should it do? Plain language is fine."
          className="min-h-[74px] w-full resize-y rounded-control bg-surface px-3.5 py-2.5 text-ink shadow-hairline outline-none placeholder:text-ink-3 focus:shadow-[0_0_0_1px_var(--accent)]"
        />
      </div>
    </Overlay>
  )
}
