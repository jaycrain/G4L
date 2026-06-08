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

// Each migration with a sentinel so we can apply only the ones a database is missing.
// A string sentinel is a table name; a {table,column} sentinel is a column (for ALTERs).
type Sentinel = string | { table: string; column: string };
const MIGRATIONS: Array<{ file: string; sentinel: Sentinel }> = [
  { file: 'migrations/0001_gateway_schema.sql', sentinel: 'door' },
  { file: 'migrations/0002_assets.sql', sentinel: 'asset_completion' },
  { file: 'migrations/0003_founder_agent.sql', sentinel: 'founder_agent_drafts' },
  { file: 'migrations/0004_avatar.sql', sentinel: { table: 'member_profile', column: 'avatar_url' } },
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

async function columnExists(db: Db, table: string, column: string): Promise<boolean> {
  const { rows } = await db.query<{ e: boolean }>(
    `select exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name=$1 and column_name=$2
     ) as e`,
    [table, column],
  );
  return Boolean(rows[0]?.e);
}

async function isApplied(db: Db, s: Sentinel): Promise<boolean> {
  return typeof s === 'string' ? tableExists(db, s) : columnExists(db, s.table, s.column);
}

/** Apply any not-yet-applied migrations, then (idempotently) re-seed. Safe on every boot. */
export async function ensureSchema(db: Db): Promise<void> {
  for (const m of MIGRATIONS) {
    if (!(await isApplied(db, m.sentinel))) await db.exec(sqlFile(m.file));
  }
  await db.exec(SEED_SQL()); // idempotent (on conflict do update)
}
