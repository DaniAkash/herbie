/**
 * Types both runtimes name.
 *
 * This file and `server/client.ts` are the only two paths the webview is
 * allowed to import from the sidecar. Anything a screen needs to know about
 * belongs here rather than being reached for in `modules/`, which is what
 * keeps `bun:sqlite` out of the browser bundle.
 */

export interface ApiInfo {
  readonly port: number | null
  readonly token: string
}

export interface ReadyLine {
  readonly ready: true
  readonly port: number
  readonly pid: number
}
