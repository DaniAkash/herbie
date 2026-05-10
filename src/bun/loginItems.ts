import { existsSync } from 'node:fs'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Updater } from 'electrobun/bun'

const BUNDLE_ID = 'herbie.daniakash.com'
const LAUNCH_AGENTS_DIR = join(homedir(), 'Library', 'LaunchAgents')
const PLIST_PATH = join(LAUNCH_AGENTS_DIR, `${BUNDLE_ID}.plist`)

function plistContents(launcherPath: string) {
  const escaped = launcherPath.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${BUNDLE_ID}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escaped}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
`
}

async function isDev(): Promise<boolean> {
  try {
    return (await Updater.localInfo.channel()) === 'dev'
  } catch {
    return false
  }
}

function launcherPath(): string {
  // Bun.argv[0] is the bun binary itself; argv[1] is the entry script.
  // The Electrobun-bundled launcher lives in Contents/MacOS/launcher and
  // re-execs the bun binary which lands here. We resolve back up to the
  // .app bundle to find the canonical entry point: Contents/MacOS/launcher.
  const exec = process.execPath
  const idx = exec.indexOf('.app/Contents/')
  if (idx === -1) return exec
  return `${exec.slice(0, idx + '.app/Contents/'.length)}MacOS/launcher`
}

export async function setLoginItem(enabled: boolean): Promise<void> {
  if (await isDev()) return
  await mkdir(LAUNCH_AGENTS_DIR, { recursive: true })
  if (enabled) {
    await writeFile(PLIST_PATH, plistContents(launcherPath()), 'utf8')
  } else if (existsSync(PLIST_PATH)) {
    await unlink(PLIST_PATH)
  }
}
