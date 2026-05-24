import fixPath from 'fix-path'

// macOS GUI-launched .apps inherit the launchd minimal PATH
// (/usr/bin:/bin:/usr/sbin:/sbin) — NOT the user's interactive shell
// PATH. That breaks every `spawn('npx', […])`, `spawn('claude', […])`,
// etc. with ENOENT.
//
// Delegate to sindresorhus/fix-path: it shells out via shell-path /
// shell-env which wraps `echo $PATH` in unique delimiters so any
// stdout from .zshrc/.bashrc init (fnm warnings, nvm messages, MOTD
// scripts, custom echos) gets stripped out instead of being mistaken
// for the PATH. Also runs strip-ansi on the result so colorized rc
// files don't poison the path with escape codes.
//
// fix-path mutates process.env.PATH directly; subsequent
// child_process.spawn / Bun.spawn calls inherit it.
export function fixMacOsPath(): void {
  // fix-path skips win32 internally; we additionally gate on darwin
  // so Linux GUI launches don't take the shell-spawn hit until we
  // decide we want it there. (Most Linux desktop entries inherit PATH
  // from the user's session.)
  if (process.platform !== 'darwin') return
  fixPath()
}
