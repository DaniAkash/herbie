/**
 * A path as a person would write it, with the home directory as a tilde.
 *
 * Done by pattern rather than by asking the sidecar for the real home
 * directory: it is only ever used for display, a miss leaves the full path
 * showing, and the alternative is a round trip and a cache entry to make a
 * label four characters shorter.
 */
export function shortenHome(path: string): string {
  return path.replace(/^\/(?:Users|home)\/[^/]+/, '~')
}
