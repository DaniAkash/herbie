/**
 * A link, or nothing, so that only the two web schemes become an `href`.
 *
 * The schema already refuses anything else and the window's content policy
 * already refuses to run `javascript:`, which makes this the third lock on
 * the same door. It is here anyway because this is the component that hands
 * a string the agent wrote to the operating system, and the cost of being
 * sure at that point is one function.
 */
export function webHref(href: string | undefined): string | undefined {
  if (href === undefined) return undefined
  return /^https?:\/\//i.test(href) ? href : undefined
}

export function countedSources(count: number): string {
  return count === 1 ? '1 source' : `${count} sources`
}
