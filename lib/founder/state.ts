// Per-operator console state (migration 0069). Today: "when did I last look at Activity?"
//
// PER ACCOUNT, NOT PER DEVICE — the whole point. Jay moves between a MacBook, an iPad and an iPhone, so a
// browser-local marker would either show him the same seven events three times or hide them after the first
// device. One marker, following the person.
//
// Schema-tolerant like everything after a hand-applied migration: before 0069, "last seen" reads as null,
// which the feed treats as "never looked" — so everything shows as new. That is the honest degradation, not
// a broken one.

import type { Db } from '../db/schema.ts';

let tableConfirmed = false;
export function __resetFounderStateCache(): void { tableConfirmed = false; }

async function hasTable(db: Db): Promise<boolean> {
  if (tableConfirmed) return true;
  try {
    const { rows } = await db.query<{ e: boolean }>(
      `select exists (select 1 from information_schema.tables
         where table_schema='public' and table_name='founder_state') as e`,
    );
    tableConfirmed = Boolean(rows[0]?.e); // positive only — see lib/founder/thread.ts for why
    return tableConfirmed;
  } catch { return false; }
}

/** When Jay last opened Activity. null = never (or pre-migration) → treat everything as new. */
export async function getActivitySeenAt(db: Db, operator = 'jay'): Promise<string | null> {
  if (!(await hasTable(db))) return null;
  try {
    const { rows } = await db.query<{ activity_seen_at: string | null }>(
      `select activity_seen_at from founder_state where operator = $1`, [operator],
    );
    const v = rows[0]?.activity_seen_at ?? null;
    return v ? new Date(v).toISOString() : null;
  } catch (e) {
    console.error('[founder] could not read the activity marker:', e);
    return null;
  }
}

/**
 * Stamp "I have now seen everything up to here".
 *
 * Takes the time explicitly rather than using now(): the caller stamps the moment it RENDERED the feed, so
 * anything that lands during the round trip is still new next time instead of being silently swallowed.
 */
export async function markActivitySeen(db: Db, at: string, operator = 'jay'): Promise<void> {
  if (!(await hasTable(db))) return;
  try {
    await db.query(
      `insert into founder_state (operator, activity_seen_at, updated_at) values ($1, $2, now())
       on conflict (operator) do update set activity_seen_at = excluded.activity_seen_at, updated_at = now()`,
      [operator, at],
    );
  } catch (e) {
    console.error('[founder] could not stamp the activity marker:', e);
  }
}
