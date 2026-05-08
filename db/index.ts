import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

let cached: DrizzleClient | null = null;

function buildClient(): DrizzleClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  const client = postgres(databaseUrl, { prepare: false, max: 1 });
  return drizzle(client, { schema });
}

export const db: DrizzleClient = new Proxy({} as DrizzleClient, {
  get(_target, prop) {
    if (!cached) cached = buildClient();
    const value = Reflect.get(cached, prop);
    return typeof value === 'function' ? value.bind(cached) : value;
  },
});

export * from './schema';
