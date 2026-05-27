import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { setCurrentFocus } from '../notifications/focus-state'

const focusSchema = z
  .object({
    conversationId: z.string().min(1).nullable(),
  })
  .strict()

export const focusRoute = new Hono().post(
  '/focus',
  zValidator('json', focusSchema),
  (c) => {
    const { conversationId } = c.req.valid('json')
    setCurrentFocus(conversationId)
    return c.json({ ok: true })
  },
)
