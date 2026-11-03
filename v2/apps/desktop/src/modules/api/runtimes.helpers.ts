import type { Runtime } from '@/modules/api/runtimes.hooks'

/**
 * Whether the runtime answered that nobody is signed in.
 *
 * Read from the error code rather than from `signedIn`, which is false for
 * every probe that failed. A timeout or a spawn failure is not a sign in
 * problem, and offering a sign in button for one sends the person to a page
 * that cannot help them.
 */
export function needsSignIn(runtime: Runtime): boolean {
  return runtime.probeError === 'auth_required'
}
