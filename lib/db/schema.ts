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

export const MIGRATION_SQL = () => sqlFile('migrations/0001_gateway_schema.sql');
export const SEED_SQL = () => sqlFile('seed/0001_reference_data.sql');

/** Apply migration + seed unconditionally (use on a fresh database). */
export async function applySchema(db: Db): Promise<void> {
  await db.exec(MIGRATION_SQL());
  await db.exec(SEED_SQL());
}

/** Apply schema only if it hasn't been applied yet (safe to call on every boot). */
export async function ensureSchema(db: Db): Promise<void> {
  const { rows } = await db.query<{ exists: boolean }>(
    "select to_regclass('public.door') is not null as exists",
  );
  if (!rows[0]?.exists) await applySchema(db);
}
