import { execSync } from 'node:child_process'

// macOS GUI-launched .apps inherit the launchd minimal PATH
// (/usr/bin:/bin:/usr/sbin:/sbin) — NOT the user's interactive shell
// PATH. That breaks every `spawn('npx', […])`, `spawn('claude', […])`,
// etc. with ENOENT.
//
// Run the user's login shell once at boot to capture their real PATH
// (post-zshrc/bashrc), then assign it to process.env.PATH. Every
// subsequent spawn inherits process.env by default, so the fix is
// global with no per-spawn plumbing.
//
// Industry-standard approach — equivalent to sindresorhus/fix-path
// for Electron, ported to plain Bun.
export function fixMacOsPath(): void {
  if (process.platform !== 'darwin') return

  const shell = Bun.env.SHELL ?? '/bin/zsh'

  try {
    const output = execSync(`${shell} -ilc 'echo $PATH'`, {
      encoding: 'utf8',
      timeout: 3_000,
    }).trim()

    if (output) {
      // Bun.env IS process.env in Bun runtime — same backing object.
      // Mutating it propagates to every subsequent child_process.spawn
      // and Bun.spawn call.
      Bun.env.PATH = output
    }
  } catch {
    // Best-effort. If the user's shell init is broken or absent,
    // keep the minimal PATH and let spawn() produce its own clear
    // ENOENT error. Don't crash boot over a PATH fix.
  }
}
