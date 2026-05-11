import { toast } from 'sonner'

// Shapes we know the bun API emits on error:
// - `{ error: 'task not found' }` from explicit `c.json({ error }, 4xx)`
// - zod-validator's flattened error body on 400 (`{ success: false, error: { ... } }`)
// - anything thrown before parseResponse — a raw Error
type AnyError = Error & {
  status?: number
  body?: unknown
}

interface ZodValidatorBody {
  success: false
  error: {
    issues: Array<{ path: (string | number)[]; message: string }>
  }
}

function extractMessage(err: unknown): string {
  if (!err) return 'Unknown error'
  const e = err as AnyError
  const body = e.body
  if (body && typeof body === 'object') {
    if ('error' in body) {
      const errField = (body as { error: unknown }).error
      if (typeof errField === 'string') return errField
      // zod-validator wraps: { success: false, error: { issues: [...] } }
      const issues = (body as ZodValidatorBody).error?.issues
      if (Array.isArray(issues) && issues.length > 0) {
        return issues
          .map((i) => `${i.path.join('.') || 'value'}: ${i.message}`)
          .join('; ')
      }
    }
  }
  if (e.message) return e.message
  return 'Unknown error'
}

// Renders a destructive toast with a contextual title + the
// server's message. Use as `onError: toastApiError('Failed to …')`
// on every user-initiated mutation so the renderer never swallows
// a failure silently.
export function toastApiError(title: string) {
  return (err: unknown): void => {
    toast.error(title, {
      description: extractMessage(err),
    })
  }
}
