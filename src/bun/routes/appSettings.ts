import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  appSettings,
  SETTINGS_SINGLETON_ID,
} from '../../db/schema/app-settings.sql'
import { getDb } from '../db-singleton'
import { serializeTimestamps } from './serialize'

const patchSchema = z
  .object({
    launchAtLogin: z.boolean().optional(),
    minimizeToMenubarOnClose: z.boolean().optional(),
  })
  .strict()

async function readOrCreate() {
  const db = getDb()
  const found = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, SETTINGS_SINGLETON_ID))
    .get()
  if (found) return found
  const row = {
    id: SETTINGS_SINGLETON_ID,
    launchAtLogin: false,
    minimizeToMenubarOnClose: true,
    updatedAt: new Date(),
  }
  await db.insert(appSettings).values(row).run()
  return row
}

export const appSettingsRoute = new Hono()
  .get('/app-settings', async (c) => {
    const row = await readOrCreate()
    return c.json(serializeTimestamps(row))
  })
  .patch('/app-settings', zValidator('json', patchSchema), async (c) => {
    const patch = c.req.valid('json')
    const db = getDb()
    await readOrCreate()
    await db
      .update(appSettings)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(appSettings.id, SETTINGS_SINGLETON_ID))
      .run()
    const updated = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, SETTINGS_SINGLETON_ID))
      .get()
    if (!updated) {
      return c.json({ error: 'failed to load updated row' }, 500)
    }
    return c.json(serializeTimestamps(updated))
  })
