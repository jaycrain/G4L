// Schema application helper — shared by the app's local DB singleton and the tests.
// Reads the canonical migration + seed (resolved relative to this file, so it works
// regardless of cwd) and applies them. Idempotent via ensureSchema.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Db = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  exec: (sql: string) => Promise<unknown>;
  /** Run fn inside a transaction that tags the audit actor (sets the per-txn GUC g4l.actor, read by
   *  the member_profile_audit trigger — migration 0032). Optional: backends without transaction
   *  support (raw pglite in tests) omit it, and writes log the default actor 'system'. Prefer the
   *  writeAsActor() helper, which falls back gracefully. */
  withActor?: <T>(actor: string, fn: (tx: Db) => Promise<T>) => Promise<T>;
};

// Resolved from the project root (cwd) — stable under `next dev`, tests, and scripts alike.
const sqlFile = (rel: string) => readFileSync(join(process.cwd(), 'supabase', rel), 'utf8');

// Each migration with a sentinel so we can apply only the ones a database is missing.
// A string sentinel is a table name; a {table,column} sentinel is a column (for ALTERs).
type Sentinel = string | { table: string; column: string } | { sql: string };
const MIGRATIONS: Array<{ file: string; sentinel: Sentinel }> = [
  { file: 'migrations/0001_gateway_schema.sql', sentinel: 'door' },
  { file: 'migrations/0002_assets.sql', sentinel: 'asset_completion' },
  { file: 'migrations/0003_founder_agent.sql', sentinel: 'founder_agent_drafts' },
  { file: 'migrations/0004_avatar.sql', sentinel: { table: 'member_profile', column: 'avatar_url' } },
  { file: 'migrations/0005_founder_trigger_key.sql', sentinel: { table: 'founder_agent_drafts', column: 'trigger_key' } },
  { file: 'migrations/0006_push_subscription.sql', sentinel: 'push_subscription' },
  { file: 'migrations/0007_activity.sql', sentinel: 'activity_event' },
  { file: 'migrations/0008_nudge_log.sql', sentinel: 'nudge_log' },
  { file: 'migrations/0009_accounts.sql', sentinel: 'member_credential' },
  { file: 'migrations/0010_agent_message.sql', sentinel: 'agent_message' },
  { file: 'migrations/0011_bite_consumed.sql', sentinel: 'bite_consumed' },
  { file: 'migrations/0012_member_door.sql', sentinel: 'member_door' },
  { file: 'migrations/0013_enable_rls.sql', sentinel: '_rls_enabled' },
  { file: 'migrations/0014_beat_engine.sql', sentinel: 'reclaim_item' },
  { file: 'migrations/0015_field_guide_seen.sql', sentinel: { table: 'member_profile', column: 'field_guide_seen_at' } },
  { file: 'migrations/0016_onboarding_session.sql', sentinel: 'onboarding_session' },
  { file: 'migrations/0017_playbook.sql', sentinel: 'playbook_entry' },
  { file: 'migrations/0018_threshold.sql', sentinel: { table: 'member_profile', column: 'threshold_crossed_at' } },
  {
    file: 'migrations/0019_reclaim_life_category.sql',
    sentinel: {
      sql: "select exists (select 1 from pg_constraint where conname='reclaim_item_category_check' and pg_get_constraintdef(oid) like '%life%') as e",
    },
  },
  { file: 'migrations/0020_measure.sql', sentinel: 'measure' },
  { file: 'migrations/0021_agent_memory.sql', sentinel: { table: 'member_profile', column: 'agent_memory' } },
  { file: 'migrations/0022_dashboard_snapshot.sql', sentinel: { table: 'member_profile', column: 'dashboard_snapshot' } },
  { file: 'migrations/0023_curriculum_slice.sql', sentinel: 'session_progress' },
  {
    file: 'migrations/0024_playbook_session_source.sql',
    sentinel: {
      sql: "select exists (select 1 from pg_constraint where conname='playbook_entry_source_kind_check' and pg_get_constraintdef(oid) like '%session%') as e",
    },
  },
  { file: 'migrations/0025_phase_crossing_seen.sql', sentinel: { table: 'member_profile', column: 'phase_crossing_seen' } },
  { file: 'migrations/0026_daily_beat_log.sql', sentinel: 'daily_beat_log' },
  { file: 'migrations/0027_playbook_synthesis.sql', sentinel: { table: 'member_profile', column: 'playbook_synthesis' } },
  { file: 'migrations/0028_member_event.sql', sentinel: 'member_event' },
  { file: 'migrations/0029_member_feedback.sql', sentinel: 'member_feedback' },
  {
    file: 'migrations/0030_activity_tokens.sql',
    sentinel: { table: 'activity_connection', column: 'access_token_enc' },
  },
  { file: 'migrations/0031_post_ceremony_tour.sql', sentinel: { table: 'member_profile', column: 'tour_completed_at' } },
  {
    file: 'migrations/0032_member_profile_audit_trigger.sql',
    sentinel: { sql: "select exists (select 1 from pg_trigger where tgname = 'member_profile_audit_del') as e" },
  },
  {
    file: 'migrations/0033_audit_skip_derived_columns.sql',
    sentinel: { sql: "select (pg_get_functiondef('audit_member_profile'::regproc) ilike '%dashboard_snapshot%') as e" },
  },
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
  if (typeof s === 'string') return tableExists(db, s);
  if ('sql' in s) {
    const { rows } = await db.query<{ e: boolean }>(s.sql);
    return Boolean(rows[0]?.e);
  }
  return columnExists(db, s.table, s.column);
}

/** Apply any not-yet-applied migrations, then (idempotently) re-seed. Safe on every boot. */
export async function ensureSchema(db: Db): Promise<void> {
  for (const m of MIGRATIONS) {
    if (!(await isApplied(db, m.sentinel))) await db.exec(sqlFile(m.file));
  }
  await db.exec(SEED_SQL()); // idempotent (on conflict do update)
}
