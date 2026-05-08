import { zValidator } from '@hono/zod-validator'
import { Utils } from 'electrobun/bun'
import { Hono } from 'hono'
import { z } from 'zod'

const openExternalSchema = z
  .object({
    url: z
      .string()
      .url()
      // Restrict to web schemes — the WKWebView round-trip should not be a
      // way to launch arbitrary local-protocol handlers (file://, custom
      // schemes wired to other apps, etc).
      .refine((u) => /^https?:\/\//i.test(u), 'only http(s) URLs are allowed'),
  })
  .strict()

export const systemRoute = new Hono().post(
  '/open-external',
  zValidator('json', openExternalSchema),
  (c) => {
    const { url } = c.req.valid('json')
    const ok = Utils.openExternal(url)
    return c.json({ ok })
  },
)
