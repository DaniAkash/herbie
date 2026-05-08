import { hc } from 'hono/client'
import type { AppType } from '../bun/server'

export function createApiClient(baseUrl: string) {
  return hc<AppType>(baseUrl)
}
