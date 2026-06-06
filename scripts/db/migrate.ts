// Apply all migrations + seed to a hosted Postgres (Supabase). Run once after creating the
// project, and again whenever a new migration lands:
//   DATABASE_URL=... npm run db:migrate   (or put DATABASE_URL in .env.local)
// Uses the postgres.js simple protocol so multi-statement DDL applies cleanly.
// NOTE: never prints DATABASE_URL — errors are masked so credentials can't leak to logs.

import postgres from 'postgres';
import { applySchema, type Db } from '../../lib/db/schema.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (your Supabase connection string) first — see DEPLOY.md.');
  process.exit(1);
}

let sql: ReturnType<typeof postgres> | undefined;
try {
  sql = postgres(url, { prepare: false, ssl: 'require' });
  const db: Db = {
    query: async (text: string, params: unknown[] = []) => ({ rows: (await sql!.unsafe(text, params as any[])) as unknown as never[] }),
    exec: async (text: string) => { await sql!.unsafe(text); },
  };
  await applySchema(db);
  console.log('✓ migrations + seed applied to Supabase');
} catch (e) {
  const err = e as { code?: string; message?: string };
  // Print only a code + short reason — NEVER the URL/credentials.
  const hint =
    err.code === '28P01' ? 'password authentication failed — check the DB password in DATABASE_URL'
    : err.code === 'ERR_INVALID_URL' ? 'DATABASE_URL is malformed — check for a doubled/garbled string'
    : (err.message ?? String(e)).split('\n')[0];
  console.error(`✗ migration failed${err.code ? ` (${err.code})` : ''}: ${hint}`);
  process.exitCode = 1;
} finally {
  try { await sql?.end(); } catch { /* ignore */ }
}
