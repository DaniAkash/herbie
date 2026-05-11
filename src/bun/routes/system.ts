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

const pickDirectorySchema = z
  .object({
    startingFolder: z.string().optional(),
  })
  .strict()

export const systemRoute = new Hono()
  .post('/open-external', zValidator('json', openExternalSchema), (c) => {
    const { url } = c.req.valid('json')
    const ok = Utils.openExternal(url)
    return c.json({ ok })
  })
  .post(
    '/system/pick-directory',
    zValidator('json', pickDirectorySchema),
    async (c) => {
      const body = c.req.valid('json')
      // openFileDialog returns CSV of selected paths; an empty string means
      // the user dismissed the panel. We only ever ask for a single dir.
      const paths = await Utils.openFileDialog({
        startingFolder: body.startingFolder ?? '~/',
        canChooseFiles: false,
        canChooseDirectory: true,
        allowsMultipleSelection: false,
      })
      const first = paths[0]?.trim()
      return c.json({ path: first ? first : null })
    },
  )
