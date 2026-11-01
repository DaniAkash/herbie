import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { AgentFace } from '@/components/agent/AgentFace'
import { Button } from '@/components/atoms/Button'
import {
  ColorSelector,
  ColorSelectorItem,
  ColorSelectorList,
} from '@/components/motion/color-selector'
import { Input } from '@/components/motion/input'
import { Overlay } from '@/components/shell/Overlay'
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
        {/* beui's own swatch group, rather than six buttons of ours */}
        <ColorSelector
          value={color}
          onValueChange={setColor}
          aria-label="Colour"
        >
          <ColorSelectorList>
            {COLORS.map((c) => (
              <ColorSelectorItem
                key={c}
                value={c}
                color={`var(--f-${c})`}
                label={c}
              />
            ))}
          </ColorSelectorList>
        </ColorSelector>
        <textarea
          placeholder="What should it do? Plain language is fine."
          className="min-h-[74px] w-full resize-y rounded-control bg-surface px-3.5 py-2.5 text-ink shadow-hairline outline-none placeholder:text-ink-3 focus:shadow-[0_0_0_1px_var(--accent)]"
        />
      </div>
    </Overlay>
  )
}
