import { z } from 'zod'

/**
 * What is on top of the window.
 *
 * The agent and its panel tab are paths, because they are where you are. The
 * overlays are a search param, because a sibling route would unmount the
 * shell underneath them and because dismissing one should be a history step.
 *
 * `.catch` rather than `.default`, so a hand-mangled url closes the overlay
 * instead of throwing into the error component.
 */
export const overlaySchema = z.object({
  overlay: z
    .enum(['new', 'tools', 'server', 'herbie', 'search', 'routine'])
    .optional()
    .catch(undefined),
  /**
   * Which step of the new agent flow is showing.
   *
   * A param rather than state, so Back is a history step and the modal does
   * not have to own a notion of where you are in it. The draft itself stays
   * in the overlay, which is mounted across both steps.
   */
  step: z.enum(['who', 'runs']).optional().catch(undefined),
  /** An mcp server id, or 'new'. Only read when overlay is 'server'. */
  server: z.string().optional().catch(undefined),
})

export type OverlaySearch = z.infer<typeof overlaySchema>
export type OverlayName = NonNullable<OverlaySearch['overlay']>

/** Spread into a Link's search to open one, so no caller hand-writes keys. */
export const openOverlay =
  (overlay: OverlayName, server?: string) =>
  (prev: OverlaySearch): OverlaySearch => ({
    ...prev,
    overlay,
    server,
    step: overlay === 'new' ? 'who' : undefined,
  })

/** Moves the new agent flow between its two steps. */
export const atStep =
  (step: NonNullable<OverlaySearch['step']>) =>
  (prev: OverlaySearch): OverlaySearch => ({ ...prev, step })

/** Spread into a Link's search to dismiss whatever is open. */
export const closeOverlay = (prev: OverlaySearch): OverlaySearch => ({
  ...prev,
  overlay: undefined,
  server: undefined,
  step: undefined,
})
