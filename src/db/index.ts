import { existsSync } from 'node:fs'
import { copyFile, mkdir, rename, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { type Client, createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema/schema'

const HERBIE_DIR = join(homedir(), '.herbie')
const DB_PATH = join(HERBIE_DIR, 'data.db')
const BACKUP_PATH = `${DB_PATH}.backup`

function migrationsFolder(): string {
  return new URL('../../drizzle', import.meta.url).pathname
}

export type Opened = {
  client: Client
  db: ReturnType<typeof drizzle<typeof schema>>
}

async function open(): Promise<Opened> {
  const client = createClient({ url: `file:${DB_PATH}` })
  await client.execute('PRAGMA journal_mode = WAL')
  return { client, db: drizzle(client, { schema }) }
}

export async function initializeDatabase(): Promise<Opened> {
  await mkdir(HERBIE_DIR, { recursive: true })
  if (existsSync(DB_PATH)) await copyFile(DB_PATH, BACKUP_PATH)

  const opened = await open()
  try {
    await migrate(opened.db, { migrationsFolder: migrationsFolder() })
    if (existsSync(BACKUP_PATH)) await unlink(BACKUP_PATH)
    return opened
  } catch (err) {
    opened.client.close()
    if (existsSync(BACKUP_PATH)) await rename(BACKUP_PATH, DB_PATH)
    // biome-ignore lint/suspicious/noConsole: surface migration failures at boot — only place a logger isn't yet wired
    console.error('migration failed, restored from backup', err)
    return open()
  }
}

export type DB = Opened['db']
