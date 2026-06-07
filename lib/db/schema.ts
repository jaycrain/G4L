// Schema application helper — shared by the app's local DB singleton and the tests.
// Reads the canonical migration + seed (resolved relative to this file, so it works
// regardless of cwd) and applies them. Idempotent via ensureSchema.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Db = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  exec: (sql: string) => Promise<unknown>;
};

// Resolved from the project root (cwd) — stable under `next dev`, tests, and scripts alike.
const sqlFile = (rel: string) => readFileSync(join(process.cwd(), 'supabase', rel), 'utf8');

// Each migration with a sentinel table so we can apply only the ones a database is missing.
const MIGRATIONS: Array<{ file: string; sentinel: string }> = [
  { file: 'migrations/0001_gateway_schema.sql', sentinel: 'door' },
  { file: 'migrations/0002_assets.sql', sentinel: 'asset_completion' },
  { file: 'migrations/0003_founder_agent.sql', sentinel: 'founder_agent_drafts' },
];
export const SEED_SQL = () => sqlFile('seed/0001_reference_data.sql');

/** Apply all migrations in order + seed (use on a fresh database; tests/verify). */
export async function applySchema(db: Db): Promise<void> {
  for (const m of MIGRATIONS) await db.exec(sqlFile(m.file));
  await db.exec(SEED_SQL());
}

async function tableExists(db: Db, t: string): Promise<boolean> {
  const { rows } = await db.query<{ e: boolean }>(`select to_regclass('public.${t}') is not null as e`);
  return Boolean(rows[0]?.e);
}

/** Apply any not-yet-applied migrations, then (idempotently) re-seed. Safe on every boot. */
export async function ensureSchema(db: Db): Promise<void> {
  for (const m of MIGRATIONS) {
    if (!(await tableExists(db, m.sentinel))) await db.exec(sqlFile(m.file));
  }
  await db.exec(SEED_SQL()); // idempotent (on conflict do update)
}
