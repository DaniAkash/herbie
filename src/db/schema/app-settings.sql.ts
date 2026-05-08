import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const SETTINGS_SINGLETON_ID = 'singleton'

export const appSettings = sqliteTable('app_settings', {
  id: text('id').primaryKey(),
  launchAtLogin: integer('launch_at_login', { mode: 'boolean' })
    .notNull()
    .default(false),
  minimizeToMenubarOnClose: integer('minimize_to_menubar_on_close', {
    mode: 'boolean',
  })
    .notNull()
    .default(true),
  defaultAgent: text('default_agent').notNull().default('claude'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export type AppSettings = typeof appSettings.$inferSelect
