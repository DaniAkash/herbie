type WireValue<V> = V extends Date ? number : V
type Serialize<T> = { [K in keyof T]: WireValue<T[K]> }

export function serializeTimestamps<T extends Record<string, unknown>>(
  row: T,
): Serialize<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? v.getTime() : v
  }
  return out as Serialize<T>
}
