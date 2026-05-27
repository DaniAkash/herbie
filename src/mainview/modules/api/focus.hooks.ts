import type { InferRequestType } from 'hono/client'
import { createMutation } from 'react-query-kit'
import { api } from './client'
import { parseResponse } from './parseResponse'

const $post = api.focus.$post
type FocusInput = InferRequestType<typeof $post>['json']

// Fire-and-forget heartbeat. No invalidation, no toast on error: a
// dropped report is recoverable because the renderer will resend on
// the next focus/blur or route change, and the bun side has a 10s
// staleness guard if reports stop arriving entirely.
export const useReportFocus = createMutation<unknown, FocusInput>({
  mutationFn: (json) => $post({ json }).then(parseResponse),
})
