// DO MEMBERS TAP, OR TELL?
//
// ("Route", not "door": the Door is the life event that opened someone's Fade, and overloading a brand term makes
// a reader parse the wrong noun. The naming guard caught this before review did.)
//
// Greg's W3 Engineering Memo asks the Companion to support the tracking habit "through anchoring, FRICTION
// REDUCTION, and streak reinforcement", and leads its UX requirements with "Quick check-in interface — low-friction
// daily entry". Whether members actually use the fast surface or the conversation is the direct measurement of
// that, and it is the one thing that cannot be recovered later: an unrecorded route is gone.
//
// AGGREGATE ONLY, ON PURPOSE. The question is "do members tap or tell", which needs counts, not names. This reads
// no member identifier and returns none — it cannot be used to look at a person. It also reads no CONTENT: the
// rule this and migration 0076 were built to (Jay + CC, 2026-08-12) is that we record that an interaction happened
// and by what route, never more of what was said. The test for the next metric like this: is it ABOUT the
// interaction, or FROM it?
//
// NULL IS A REAL ANSWER and is reported as "not recorded" rather than folded into a bucket. Rows written before
// 0076 genuinely do not know their door, and quietly counting them as 'companion' would manufacture the finding.

import type { Db } from '../db/schema.ts';

export type DoorCount = { tracker: string; source: string; days: number };

/** Days logged per tracker per door, over the last N days. Drift-hardened — a hiccup hides the card, not the page. */
export async function trackerDoors(db: Db, days = 30): Promise<DoorCount[]> {
  try {
    const { rows } = await db.query<{ tracker: string; source: string | null; days: number }>(
      `select 'Noticing your days' as tracker, source, count(*)::int as days
         from w3_daily_entry where entry_date > current_date - ($1 || ' days')::interval group by source
       union all
       select 'Quality Days', source, count(*)::int
         from quality_day_log where logged_on > current_date - ($1 || ' days')::interval group by source
       union all
       select 'Lifestyle Pilot / Noticing a skill', source, count(*)::int
         from practice_mark where marked_on > current_date - ($1 || ' days')::interval group by source
       order by 1, 2`,
      [String(days)],
    );
    return rows.map((r) => ({ tracker: r.tracker, source: r.source ?? 'not recorded', days: r.days }));
  } catch (e) {
    console.error('trackerDoors read failed:', e);
    return [];
  }
}
