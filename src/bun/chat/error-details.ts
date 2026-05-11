// Pulls the human message, a stable code, and any structured details
// off of whatever was thrown. acpx surfaces JSON-RPC errors with a
// numeric `code` and a `data.details` string (e.g. "Unknown config
// option: reasoning_effort") — preserving both gives the renderer
// enough to show a useful error block instead of just "Internal error".
export function extractErrorDetails(err: unknown): {
  message: string
  code: string | undefined
  details: string | undefined
} {
  if (!(err instanceof Error)) {
    return { message: String(err), code: undefined, details: undefined }
  }
  const codeProp = (err as { code?: unknown }).code
  const dataProp = (err as { data?: unknown }).data
  const detailsFromData =
    dataProp && typeof dataProp === 'object'
      ? (dataProp as { details?: unknown }).details
      : undefined
  return {
    message: err.message,
    code:
      typeof codeProp === 'string' || typeof codeProp === 'number'
        ? String(codeProp)
        : err.name,
    details: typeof detailsFromData === 'string' ? detailsFromData : undefined,
  }
}
