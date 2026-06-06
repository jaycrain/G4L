// Apply all migrations + seed to a hosted Postgres (Supabase). Run once after creating the
// project, and again whenever a new migration lands:
//   DATABASE_URL=... npm run db:migrate   (or put DATABASE_URL in .env.local)
// Uses the postgres.js simple protocol so multi-statement DDL applies cleanly.

import postgres from 'postgres';
import { applySchema, type Db } from '../../lib/db/schema.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (your Supabase connection string) first — see DEPLOY.md.');
  process.exit(1);
}

const sql = postgres(url, { prepare: false });
const db: Db = {
  query: async (text: string, params: unknown[] = []) => ({ rows: (await sql.unsafe(text, params as unknown[])) as unknown as never[] }),
  exec: async (text: string) => { await sql.unsafe(text); },
};

await applySchema(db);
console.log('✓ migrations + seed applied to', url.replace(/:[^:@/]*@/, ':****@'));
await sql.end();
