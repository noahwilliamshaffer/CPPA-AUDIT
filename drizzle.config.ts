import { defineConfig } from 'drizzle-kit';
import path from 'path';

const DB_PATH =
  process.env.DATABASE_PATH ??
  path.join(process.cwd(), 'shieldaudit.db');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: DB_PATH },
});
