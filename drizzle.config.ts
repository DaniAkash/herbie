import { homedir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'drizzle-kit'

const HERBIE_DIR = join(homedir(), '.herbie')
const DB_PATH = join(HERBIE_DIR, 'data.db')

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema/schema.ts',
  out: './drizzle',
  dbCredentials: { url: `file:${DB_PATH}` },
})
