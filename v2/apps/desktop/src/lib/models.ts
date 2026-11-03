/** What a runtime's own default is called wherever a model can be chosen. */
export const OWN_DEFAULT = 'Its default'

/**
 * The models a runtime reports, with its own default in front.
 *
 * Base UI reads the labels for the trigger from this list rather than from
 * the items rendered under it, and a null item that is named here is what
 * lets the default read as the answer it is instead of as a placeholder.
 */
export function modelItems(
  models: readonly string[],
): { value: string | null; label: string }[] {
  return [
    { value: null, label: OWN_DEFAULT },
    ...models.map((m) => ({ value: m, label: m })),
  ]
}
