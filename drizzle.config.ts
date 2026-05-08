import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';

config({ path: '.env.local' });
config({ path: '.env' });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run drizzle-kit');
}

export default {
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  strict: true,
} satisfies Config;
