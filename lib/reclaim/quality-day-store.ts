// Reclaim C3 · Quality Days — the store. The QUALITY-DAY PROFILE (the tiered definition: top-3 non-negotiables /
// next-3 contributors / top-2 disruptors — Greg's simple ranking) rides the generic coaching_plan (phase 'reclaim',
// kind 'quality_day_profile', status 'active' — most-recent-active-wins). The DAILY LOG rides quality_day_log (0055),
// one row per day. Both durable + retrievable (RC-4). Manual logging only (OO).

import type { Db } from '../db/schema.ts';
import { readJson, payloadKind } from '../db/jsonb.ts';
import { tagBestEffort } from '../db/best-effort.ts';

export type QualityDayProfile = {
  nonNegotiables: string[]; // top 3 — a day is hard to call "quality" without these
  contributors: string[]; // next 3 — strongly improve the day
  disruptors: string[]; // top 2 — most often pull the day down
};
// Every element the member can check off in the daily log (non-negotiables + contributors; disruptors are the drains).
export function profileElements(p: QualityDayProfile): string[] {
  return [...p.nonNegotiables, ...p.contributors];
}

// Persist the member's Quality-Day profile — a new 'active' coaching_plan row that SUPERSEDES the previous one.
// Member-confirmed at the C3 define step. Best-effort at the caller.
//
// This is where the bug was FOUND (2026-08-09). The old version only inserted, leaving every prior profile marked
// 'active', and let the reader's `order by created_at desc limit 1` decide. Re-running C3 — which is the documented
// recovery for a week that opened without its profile — writes a second row; when the two created_at values tie the
// database is free to return either, and it returned the OLD definition. The member redefines what a good day looks
// like and their week keeps tracking the definition they just replaced. See persistCoachingPlan for the general form
// and for why the insert comes BEFORE the retire.
//
// The retire is scoped by KIND as well as phase. Reclaim hosts more than one payload shape on this table, so a
// phase-only retire here would mark an unrelated reclaim plan superseded. (C1's refinement snapshots are safe either
// way — they are written status='complete', deliberately outside the active set — but relying on that would make this
// correct only by a neighbour's choice.)
export async function persistQualityDayProfile(db: Db, memberId: string, profile: QualityDayProfile): Promise<void> {
  const { rows } = await db.query<{ id: string }>(
    `insert into coaching_plan (member_id, phase, payload, status)
     values ($1, 'reclaim', $2::jsonb, 'active') returning id`,
    [memberId, JSON.stringify({ kind: 'quality_day_profile', ...profile })],
  );
  const id = rows[0]?.id;
  if (!id) return; // nothing to retire against — leave the prior profile standing rather than guess
  // WHICH ROWS ARE PROFILES IS DECIDED IN JS. `payload->>'kind'` is NULL on a jsonb string (see lib/db/jsonb.ts),
  // which made this retire a no-op on prod — harmless-looking, but it left several rows marked active and put the
  // reader back on "whichever created_at the database felt like", the exact bug the retire was added to kill.
  const { rows: siblings } = await db.query<{ id: string; payload: unknown }>(
    `select id, payload from coaching_plan where member_id=$1 and phase='reclaim' and status='active'`,
    [memberId],
  );
  const retire = siblings.filter((r) => r.id !== id && payloadKind(r.payload) === 'quality_day_profile').map((r) => r.id);
  if (!retire.length) return;
  await db.query(`update coaching_plan set status='superseded', updated_at=now() where id = any($1::uuid[])`, [retire]);
}

// The member's active Quality-Day profile (most recent). Null on none / error (drift-hardened).
export async function activeQualityDayProfile(db: Db, memberId: string): Promise<QualityDayProfile | null> {
  try {
    // THE ONE THAT COST A MEMBER THEIR TRACKER. This filtered on `payload->>'kind'`, which is NULL for a jsonb
    // string — the shape prod stores — so it returned nothing while the profile sat in the table. c3Rows then
    // produced no rows and weekGrids dropped the week as empty. Kind is matched in JS now; see lib/db/jsonb.ts.
    const { rows } = await db.query<{ payload: unknown }>(
      `select payload from coaching_plan
        where member_id=$1 and phase='reclaim' and status='active'
        order by created_at desc`,
      [memberId],
    );
    const r = rows.find((row) => payloadKind(row.payload) === 'quality_day_profile');
    if (!r) return null;
    const p = readJson<Partial<QualityDayProfile>>(r.payload) ?? {};
    return {
      nonNegotiables: Array.isArray(p.nonNegotiables) ? p.nonNegotiables : [],
      contributors: Array.isArray(p.contributors) ? p.contributors : [],
      disruptors: Array.isArray(p.disruptors) ? p.disruptors : [],
    };
  } catch (e) {
    // LOG, don't just swallow. A read failure here is INDISTINGUISHABLE from "no profile" — both render an empty
    // Quality Days grid — so a silent catch turns a broken read into a confident "you never set one up". Third
    // time this shape has cost us; the rule is assert-or-log, never a bare catch on a read the UI trusts.
    console.error(`activeQualityDayProfile read failed for member=${memberId}:`, (e as Error).message);
    return null;
  }
}

export type QualityDayEntry = { loggedOn: string; score: number; present: string[]; mostValuable?: string; mostMissing?: string };

// Log today's Quality Day — one per day (upsert). score is clamped 1–10 at the caller. present = the element labels
// that showed up today. Manual only (OO).
export async function logQualityDay(
  db: Db,
  memberId: string,
  /** `source` records WHICH ROUTE the member took — the form, or the Companion. See 0076: metadata about
   *  the interaction, never anything more about what they said. Defaults to the form, which is the only route today. */
  entry: { score: number; present?: string[]; mostValuable?: string; mostMissing?: string; loggedOn?: string; source?: string },
): Promise<{ ok: boolean }> {
  await db.query(
    // THE MEMBER'S RECORD KNOWS NOTHING ABOUT TELEMETRY. `source` is tagged on afterwards, best-effort, so a column
    // that has not been migrated yet costs a measurement and never their day. See lib/db/best-effort.ts.
    `insert into quality_day_log (member_id, logged_on, score, present, most_valuable, most_missing)
     values ($1, coalesce($2::date, current_date), $3, $4::jsonb, $5, $6)
     on conflict (member_id, logged_on) do update set
       score = excluded.score, present = excluded.present,
       most_valuable = excluded.most_valuable, most_missing = excluded.most_missing, updated_at = now()`,
    [memberId, entry.loggedOn ?? null, entry.score, JSON.stringify(entry.present ?? []), entry.mostValuable?.trim() || null, entry.mostMissing?.trim() || null],
  );
  await tagBestEffort(db, 'quality_day_log.source', `update quality_day_log set source=$3 where member_id=$1 and logged_on=coalesce($2::date, current_date)`,
    [memberId, entry.loggedOn ?? null, entry.source ?? 'form']);
  return { ok: true };
}

// The member's recent Quality-Day entries (default last 7 days, oldest→newest) — the week's logs for the review + the
// 1–10 score trend + the RC-4 "show me my scores" retrieval. Drift-hardened by the caller.
export async function recentQualityDays(db: Db, memberId: string, days = 7): Promise<QualityDayEntry[]> {
  const rows = (
    await db.query<{ logged_on: string; score: number; present: unknown; most_valuable: string | null; most_missing: string | null }>(
      // ::text in SQL, NOT String(row) in JS. A `date` comes back as a JS Date at UTC midnight, so String() renders it
      // in LOCAL time — the PREVIOUS calendar day for anyone west of Greenwich. A day the member logged on the 7th was
      // read back, and shown to them, as the 6th. Postgres formats it correctly and timezone-free; momentum/store.ts
      // already does exactly this, which is why its dates were right. (Found 2026-08-07 building the week grid — the
      // grid put a Quality Day in the wrong column and the date was the reason.)
      `select logged_on::text as logged_on, score, present, most_valuable, most_missing
         from quality_day_log
        where member_id=$1 and logged_on >= current_date - ($2::int - 1)
        order by logged_on asc`,
      [memberId, days],
    )
  ).rows;
  return rows.map((r) => ({
    loggedOn: String(r.logged_on),
    score: Number(r.score),
    present: Array.isArray(r.present) ? (r.present as string[]) : typeof r.present === 'string' ? JSON.parse(r.present) : [],
    mostValuable: r.most_valuable ?? undefined,
    mostMissing: r.most_missing ?? undefined,
  }));
}
