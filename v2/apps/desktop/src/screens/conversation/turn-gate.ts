/** Holds a send until its accepted turn has ended, including out-of-order events. */
export function createTurnGate() {
  let pending = false
  let turnId: string | null = null
  const earlyEnds = new Set<string>()
  return {
    begin() {
      if (pending) return false
      pending = true
      turnId = null
      earlyEnds.clear()
      return true
    },
    accept(id: string) {
      if (!pending) return false
      turnId = id
      if (earlyEnds.has(id)) {
        pending = false
        return false
      }
      return true
    },
    end(id: string) {
      if (!pending) return false
      if (turnId === null) earlyEnds.add(id)
      else if (turnId === id) {
        pending = false
        return true
      }
      return false
    },
    fail() {
      pending = false
      earlyEnds.clear()
    },
  }
}
