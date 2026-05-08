import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { feed } from './schema';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const client = postgres(databaseUrl, { prepare: false, max: 1 });
const db = drizzle(client);

async function main() {
  await db
    .insert(feed)
    .values([
      {
        id: 'english',
        displayName: 'English',
        language: 'english',
        broadcaster: 'star-sports',
      },
      {
        id: 'star-sports-hindi',
        displayName: 'Star Sports Hindi',
        language: 'hindi',
        broadcaster: 'star-sports',
      },
      {
        id: 'jiohotstar-hindi-championswaali',
        displayName: 'JioHotstar Hindi (Championswaali)',
        language: 'hindi',
        broadcaster: 'jiohotstar',
      },
    ])
    .onConflictDoNothing();

  console.log('Seeded feed rows.');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
