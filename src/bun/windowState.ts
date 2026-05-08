import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type WindowFrame = {
  width: number
  height: number
  x: number
  y: number
}

const DEFAULT_FRAME: WindowFrame = {
  width: 1100,
  height: 720,
  x: 200,
  y: 200,
}

const STATE_DIR = join(homedir(), '.herbie')
const STATE_FILE = join(STATE_DIR, 'window-state.json')

const MIN_WIDTH = 480
const MIN_HEIGHT = 360

function isSaneFrame(f: unknown): f is WindowFrame {
  if (!f || typeof f !== 'object') return false
  const r = f as Record<string, unknown>
  return (
    typeof r.width === 'number' &&
    typeof r.height === 'number' &&
    typeof r.x === 'number' &&
    typeof r.y === 'number' &&
    r.width >= MIN_WIDTH &&
    r.height >= MIN_HEIGHT
  )
}

export async function loadFrame(): Promise<WindowFrame> {
  try {
    const file = Bun.file(STATE_FILE)
    if (!(await file.exists())) return DEFAULT_FRAME
    const parsed = await file.json()
    return isSaneFrame(parsed) ? parsed : DEFAULT_FRAME
  } catch {
    return DEFAULT_FRAME
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingFrame: WindowFrame | null = null

async function flush() {
  saveTimer = null
  if (!pendingFrame) return
  const frame = pendingFrame
  pendingFrame = null
  try {
    await mkdir(STATE_DIR, { recursive: true })
    await Bun.write(STATE_FILE, JSON.stringify(frame, null, 2))
  } catch {
    // ignore — non-critical
  }
}

export function persistFrame(frame: WindowFrame) {
  pendingFrame = frame
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(flush, 400)
}
