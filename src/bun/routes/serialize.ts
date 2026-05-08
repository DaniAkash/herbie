export function serializeTimestamps<T extends Record<string, unknown>>(
  row: T,
): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? v.getTime() : v
  }
  return out as T
}
