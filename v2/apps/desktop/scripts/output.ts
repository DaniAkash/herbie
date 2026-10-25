/** Progress for the build scripts, which have no logger and no log level. */
export function ok(message: string, detail?: string): void {
  process.stdout.write(`  ${message}${detail ? ` ${detail}` : ''}\n`)
}
