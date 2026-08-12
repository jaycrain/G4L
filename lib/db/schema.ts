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
// EXPORTED so `scripts/db/gen-migration-drift.mjs` can build the prod drift-check SQL from THIS list rather than
// keeping its own copy. It used to keep one, and that copy silently stopped at 0055 while the repo shipped to
// 0074 — so the check that tells us whether prod is missing a migration (and therefore whether a table holding
// member material is missing its RLS) reported a clean database while inspecting none of the recent work.
// One list, one place. Adding a migration here is now the only thing anyone has to remember.
export const MIGRATIONS: Array<{ file: string; sentinel: Sentinel }> = [
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
  { file: 'migrations/0034_system_health.sql', sentinel: 'system_health' },
  { file: 'migrations/0035_connect.sql', sentinel: 'connect_post' },
  { file: 'migrations/0036_connect_safety.sql', sentinel: { table: 'connect_report', column: 'source' } },
  { file: 'migrations/0037_connect_notifications.sql', sentinel: 'connect_notification' },
  { file: 'migrations/0038_connect_rooms.sql', sentinel: 'connect_room' },
  { file: 'migrations/0039_enable_rls_sweep.sql', sentinel: '_rls_sweep_0039' },
  { file: 'migrations/0040_reclaim_item_removed.sql', sentinel: { table: 'reclaim_item', column: 'removed_at' } },
  { file: 'migrations/0041_reclaim_item_audit.sql', sentinel: { table: 'member_profile_audit', column: 'source' } },
  { file: 'migrations/0042_enable_rls_sweep.sql', sentinel: '_rls_sweep_0042' },
  { file: 'migrations/0043_member_door_crud_audit.sql', sentinel: { table: 'member_door', column: 'removed_at' } },
  { file: 'migrations/0044_instrument_tier.sql', sentinel: { table: 'atlas_asset', column: 'administration_tier' } },
  {
    file: 'migrations/0045_reclaim_list_floor.sql',
    sentinel: { sql: "select exists (select 1 from pg_constraint where conname = 'reclaim_list_min_1') as e" },
  },
  { file: 'migrations/0046_harvest_keeper.sql', sentinel: { table: 'playbook_entry', column: 'keeper_type' } },
  { file: 'migrations/0047_grinta_reading.sql', sentinel: 'grinta_reading' },
  { file: 'migrations/0048_practice_week.sql', sentinel: 'practice_week' },
  { file: 'migrations/0049_momentum_call.sql', sentinel: 'momentum_call' },
  { file: 'migrations/0050_motivation_reading.sql', sentinel: 'motivation_reading' },
  { file: 'migrations/0051_self_management_reading.sql', sentinel: 'self_management_reading' },
  { file: 'migrations/0052_coaching_plan.sql', sentinel: 'coaching_plan' },
  { file: 'migrations/0053_reclaim_item_tier.sql', sentinel: { table: 'reclaim_item', column: 'tier' } },
  { file: 'migrations/0054_bigger_world_reading.sql', sentinel: 'bigger_world_reading' },
  { file: 'migrations/0055_quality_day_log.sql', sentinel: 'quality_day_log' },
  { file: 'migrations/0056_arc_session.sql', sentinel: 'arc_session' },
  { file: 'migrations/0057_movement_log.sql', sentinel: 'movement_log' },
  { file: 'migrations/0058_outreach_pref.sql', sentinel: 'outreach_pref' },
  { file: 'migrations/0059_outreach_log.sql', sentinel: 'outreach_log' },
  { file: 'migrations/0060_commitment.sql', sentinel: 'commitment' },
  { file: 'migrations/0061_commitment_reclaim_link.sql', sentinel: { table: 'commitment', column: 'reclaim_item_id' } },
  { file: 'migrations/0062_auth_attempt.sql', sentinel: 'auth_attempt' },
  // Sentinel is the LAST thing 0063 adds, not the first — so a half-applied 0063 re-runs and completes
  // (the whole file is if-not-exists idempotent).
  { file: 'migrations/0063_auth_token.sql', sentinel: { table: 'member_credential', column: 'email_verified_at' } },
  { file: 'migrations/0064_session_token_hash.sql', sentinel: { table: 'member_session', column: 'token_hash' } },
  { file: 'migrations/0065_system_health_event.sql', sentinel: 'system_health_event' },
  { file: 'migrations/0066_founder_message.sql', sentinel: 'founder_message' },
  { file: 'migrations/0067_founder_prompt.sql', sentinel: 'founder_prompt' },
  // A DROP inverts the usual sentinel: "applied" means the column is GONE, so the check is a NOT EXISTS.
  // The {table,column} form would have read it backwards and skipped the migration forever.
  {
    file: 'migrations/0068_drop_session_token.sql',
    sentinel: {
      sql: `select not exists (
              select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'member_session' and column_name = 'token'
            ) as e`,
    },
  },
  { file: 'migrations/0069_founder_state.sql', sentinel: 'founder_state' },
  { file: 'migrations/0070_console_theme.sql', sentinel: { table: 'founder_state', column: 'theme' } },
  { file: 'migrations/0071_draft_rejected_at.sql', sentinel: { table: 'founder_agent_drafts', column: 'rejected_at' } },
  // The sentinel is the LAST thing 0072 creates (practice_week.closed_at), not the first — a run that died part-way
  // must still read as unapplied, or the tail gets skipped forever.
  { file: 'migrations/0072_practice_commitment.sql', sentinel: { table: 'practice_week', column: 'closed_at' } },
  // Same rule as 0072: the sentinel is the LAST table 0073 creates, so a half-applied run still reads as unapplied.
  { file: 'migrations/0073_operator_and_access_log.sql', sentinel: 'member_access_log' },
  // 0074 creates one table, so the table IS the last thing — no partial-run subtlety to guard against here.
  { file: 'migrations/0074_w3_daily_entry.sql', sentinel: 'w3_daily_entry' },
  { file: 'migrations/0075_bigger_world_reflections.sql', sentinel: { table: 'bigger_world_reading', column: 'reflections' } },
  // 0076 adds a column to TWO tables. The sentinel is the SECOND one, so a run that got half way still reads as
  // unapplied and gets re-run — the same rule as 0072/0073, and the reason the checker derives from this file.
  { file: 'migrations/0076_tracker_source.sql', sentinel: { table: 'quality_day_log', column: 'source' } },
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

/**
 * WHICH MIGRATIONS HAVE LANDED ON THIS DATABASE — read-only, derived from MIGRATIONS above.
 *
 * Prod does not auto-apply: migrations are pasted into the Supabase SQL Editor by hand, and "I ran it" and "it
 * landed" are different claims. Every previous way of answering this has been a separate list that drifted from
 * the real one — which is why this reads the SAME registry `ensureSchema` runs from, using the SAME sentinel test.
 * A checker that can disagree with the applier is worse than no checker; it is a confident wrong answer.
 *
 * Exposed through the read-only member diagnostic so the question "did 0076 land?" costs one call rather than a
 * deploy or a guess.
 */
export async function migrationState(db: Db): Promise<{ applied: string[]; pending: string[] }> {
  const applied: string[] = [];
  const pending: string[] = [];
  for (const m of MIGRATIONS) {
    const name = m.file.replace(/^migrations\//, '').replace(/\.sql$/, '');
    // A sentinel that THROWS is not "applied" — it is unknown, and reporting unknown as applied is the exact
    // failure this replaces.
    const ok = await isApplied(db, m.sentinel).catch(() => false);
    (ok ? applied : pending).push(name);
  }
  return { applied, pending };
}

/** Apply any not-yet-applied migrations, then (idempotently) re-seed. Safe on every boot. */
export async function ensureSchema(db: Db): Promise<void> {
  for (const m of MIGRATIONS) {
    if (!(await isApplied(db, m.sentinel))) await db.exec(sqlFile(m.file));
  }
  await db.exec(SEED_SQL()); // idempotent (on conflict do update)
}
