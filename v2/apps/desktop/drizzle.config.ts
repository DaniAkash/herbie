import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src-bun/modules/db/schema/schema.ts',
  out: './src-bun/modules/db/migrations',
})
