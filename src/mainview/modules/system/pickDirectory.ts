import { api } from '../api/client'
import { parseResponse } from '../api/parseResponse'

const $post = api.system['pick-directory'].$post

// Returns the absolute path the user selected, or null if they dismissed
// the native dialog. Wrapped here (rather than as a react-query mutation)
// because the call is one-shot and the renderer doesn't cache the result.
export async function pickDirectory(opts?: {
  startingFolder?: string
}): Promise<string | null> {
  const res = await $post({ json: opts ?? {} }).then(
    parseResponse<{ path: string | null }>,
  )
  return res.path
}
