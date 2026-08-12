// The Founder Console conversation, kept across devices (migration 0066).
//
// Jay opens the console from a bike ride and again from a desk; the thread used to live in sessionStorage and
// died with the tab. He asked for it to persist (2026-08-01).
//
// ── THIS TABLE HOLDS MEMBERS' WORDS, SECOND-HAND ────────────────────────────────────────────────────────────
// When he asks about ONE member, the Companion's reply can legitimately contain that person's gap or Reclaim
// List. So the two controls below are part of the feature, not polish on it:
//
//   RETENTION — pruned to 30 days on write. Operator continuity is a days-to-weeks need; a permanent archive of
//   conversations about members is a different product nobody asked for.
//   PURGE — "Clear this conversation" deletes rows, not just the screen.
//
// SCHEMA-TOLERANT, same as the health history and for the same reason: prod migrations are applied by hand, so
// code and schema never land together. Before 0066 this degrades to exactly the previous behaviour (the client
// still keeps its own in-tab copy), rather than erroring.

import type { Db } from '../db/schema.ts';

export type FounderTurn = { role: 'jay' | 'companion'; text: string; looked?: string[] };

const RETENTION_DAYS = 30;

let tableConfirmed = false;
/** Test seam — forget the cached answer so a fresh DB can be probed again. */
export function __resetFounderThreadCache(): void { tableConfirmed = false; }

async function hasTable(db: Db): Promise<boolean> {
  if (tableConfirmed) return true;
  try {
    const { rows } = await db.query<{ e: boolean }>(
      `select exists (select 1 from information_schema.tables
         where table_schema='public' and table_name='founder_message') as e`,
    );
    // Only the POSITIVE answer is cached: caching "no table" would leave a running instance blind after the
    // migration lands, so the gap would outlive its own cause.
    tableConfirmed = Boolean(rows[0]?.e);
    return tableConfirmed;
  } catch { return false; }
}

/** Append one exchange. Best-effort: losing continuity must never cost Jay the answer he just got. */
export async function appendFounderTurns(db: Db, turns: FounderTurn[], operator = 'jay'): Promise<void> {
  if (!turns.length || !(await hasTable(db))) return;
  try {
    for (const t of turns) {
      await db.query(
        `insert into founder_message (operator, role, text, looked) values ($1,$2,$3,$4::text::jsonb)`,
        [operator, t.role, t.text, JSON.stringify(t.looked ?? [])],
      );
    }
    await db.query(
      `delete from founder_message where operator=$1 and created_at < now() - make_interval(days => $2)`,
      [operator, RETENTION_DAYS],
    );
  } catch (e) {
    console.error('[founder] could not persist the console thread:', e);
  }
}

/** The recent thread, oldest→newest. Empty before 0066 is applied. */
export async function loadFounderThread(db: Db, limit = 40, operator = 'jay'): Promise<FounderTurn[]> {
  if (!(await hasTable(db))) return [];
  try {
    const { rows } = await db.query<{ role: string; text: string; looked: unknown }>(
      `select role, text, looked from (
         select role, text, looked, id from founder_message where operator = $1
         order by id desc limit $2
       ) recent order by id asc`,
      [operator, limit],
    );
    return rows.map((r) => ({
      role: r.role === 'jay' ? 'jay' : 'companion',
      text: r.text,
      looked: Array.isArray(r.looked) ? (r.looked as string[]) : [],
    }));
  } catch (e) {
    // An empty thread and a failed read look identical on screen, and only one of them is worth knowing about.
    console.error('[founder] console thread read failed — rendering as empty:', e);
    return [];
  }
}

/** Purge. Deletes rows, not just the screen — that is what "clear" has to mean once there is a server side. */
export async function clearFounderThread(db: Db, operator = 'jay'): Promise<void> {
  if (!(await hasTable(db))) return;
  try {
    await db.query(`delete from founder_message where operator = $1`, [operator]);
  } catch (e) {
    console.error('[founder] could not clear the console thread:', e);
  }
}
