// The Daily Beat rotation engine + state. One reflection per member per local day, phase-weighted,
// hard no-repeat until all 70 are spent, then it reshuffles (see G4L_Daily_Beat_Build_Spec §3).
// The pick is persisted in daily_beat_log so a given day is stable on refresh.
import type { Db } from '../db/schema.ts';
import { REFLECTIONS, reflectionById, type Reflection } from './reflections.ts';

const CYCLE = REFLECTIONS.length; // 70 — the no-repeat window

/** Deterministic FNV-1a hash → an index in [0, n). Keeps the daily pick reproducible per seed. */
function seededIndex(seed: string, n: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return n > 0 ? (h >>> 0) % n : 0;
}

/** Pure: pick one reflection from the unspent pool, preferring the member's current R (plus the
 * phase-agnostic universal lines), seeded so it's stable for a given member+day. */
export function selectReflection(unspent: Reflection[], currentR: string | null, seed: string): Reflection | null {
  if (!unspent.length) return null;
  const preferred = unspent.filter((r) => r.phase === currentR || r.phase === 'universal');
  const pool = preferred.length ? preferred : unspent;
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id)); // stable order for the seed
  return sorted[seededIndex(seed, sorted.length)]!;
}

/** The reflection ids spent in the member's CURRENT cycle (the rows since the last 70-line boundary).
 * Each viewing-day adds one row, so the current partial cycle is the last (count mod 70) rows. */
async function spentThisCycle(db: Db, memberId: string): Promise<Set<string>> {
  const { rows } = await db.query<{ reflection_id: string }>(
    'select reflection_id from daily_beat_log where member_id=$1 order by shown_on, created_at',
    [memberId],
  );
  const pos = rows.length % CYCLE;
  if (pos === 0) return new Set(); // a fresh cycle — everything is back in play (the reshuffle)
  return new Set(rows.slice(rows.length - pos).map((r) => r.reflection_id));
}

/** Today's reflection for the member, persisted so refreshes are stable. currentR phase-weights it. */
export async function getDailyBeat(db: Db, memberId: string, currentR: string | null, today: string): Promise<Reflection | null> {
  const existing = await db.query<{ reflection_id: string }>(
    'select reflection_id from daily_beat_log where member_id=$1 and shown_on=$2',
    [memberId, today],
  );
  if (existing.rows[0]) return reflectionById(existing.rows[0].reflection_id) ?? null;

  const spent = await spentThisCycle(db, memberId);
  const unspent = REFLECTIONS.filter((r) => !spent.has(r.id));
  const pick = selectReflection(unspent, currentR, `${memberId}|${today}`);
  if (!pick) return null;

  // Persist; on a concurrent first-load race the conflict wins and we read back the stored pick.
  const ins = await db.query<{ reflection_id: string }>(
    `insert into daily_beat_log (member_id, shown_on, reflection_id) values ($1,$2,$3)
     on conflict (member_id, shown_on) do nothing returning reflection_id`,
    [memberId, today, pick.id],
  );
  if (ins.rows[0]) return pick;
  const after = await db.query<{ reflection_id: string }>(
    'select reflection_id from daily_beat_log where member_id=$1 and shown_on=$2',
    [memberId, today],
  );
  return after.rows[0] ? (reflectionById(after.rows[0].reflection_id) ?? pick) : pick;
}
