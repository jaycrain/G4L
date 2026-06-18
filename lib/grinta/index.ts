// The GRINTA! Index — the daily "process" metric: how consistently you're showing up. It moves
// every day (rolling 14-day window), unlike the ID Score (the longitudinal "product," every 60
// days). Process → product: this is the needle that moves daily and feeds the work that lifts the
// ID Score. Named for the GRINTA! documentary (Eros Poli); Greg equates it to HARDINESS — a
// developable construct — so this v0 consistency formula is a placeholder to evolve toward the
// hardiness dimensions (commitment/control/challenge). A COMPANION metric — never alters the
// frozen ID Score. See docs/momentum-grinta-index.md.

import type { Db } from '../db/schema.ts';

export const GRINTA_WINDOW_DAYS = 14;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export type GrintaInput = { daysActive: number; workouts: number; programEvents: number; windowDays: number };

/** 0–100. Consistency (showing up) dominates; movement and program engagement round it out. */
export function grintaScore(i: GrintaInput): number {
  const consistency = clamp01(i.daysActive / i.windowDays);
  const movement = clamp01(i.workouts / 8);
  const program = clamp01(i.programEvents / 4);
  return Math.round(100 * (0.6 * consistency + 0.25 * movement + 0.15 * program));
}

export type Grinta = {
  score: number;
  daysActive: number;
  prevDaysActive: number;
  windowDays: number;
  workouts: number;
  direction: 'up' | 'down' | 'flat';
  delta: number;
  line: string;
};

// The three hardiness components (Give-Back Model v0.4): Consistency (showing up) · Recovery (clipping
// back in after a miss) · Reach (doing the hard thing). STRUCTURE is locked; the values + threshold are
// PROVISIONAL — Greg finishes the math. Consistency is real (show-up density); Recovery/Reach are
// provisional derivations from available signals so the sliders read honestly until the engine lands.
// LABELS were relabelled to the three Cs (Dashboard Reshuffle §5): Consistency→Commitment ·
// Recovery→Challenge · Reach→Choice. Labels ONLY — the keys, values, and computation are UNCHANGED
// (Slice 4 + the Greg-fold settle the operational definitions, so the label↔math gap is known debt).
export type GrintaComponent = { key: 'consistency' | 'recovery' | 'reach'; label: string; fill: number; threshold: number; passed: boolean; story: string; gloss?: string };

export function grintaComponents(g: Grinta, reclaimMoving: number): GrintaComponent[] {
  const threshold = 70; // provisional pass-line
  const pct = (x: number) => Math.round(clamp01(x) * 100);
  const consistency = pct(g.daysActive / g.windowDays);
  // Recovery: are they clipping back in? Holding/rising vs the prior window reads as recovery.
  const recovery = g.prevDaysActive === 0 ? consistency : pct(g.daysActive / Math.max(g.prevDaysActive, g.daysActive || 1));
  const reach = pct(reclaimMoving / 3); // provisional scale toward "a few goals in motion"
  return [
    {
      key: 'consistency',
      label: 'Commitment',
      fill: consistency,
      threshold,
      passed: consistency >= threshold,
      story: g.daysActive ? `Shown up ${g.daysActive} of the last ${g.windowDays} days.` : 'A fresh window — one rep gets it moving.',
    },
    {
      key: 'recovery',
      label: 'Challenge',
      fill: recovery,
      threshold,
      passed: recovery >= threshold,
      story: g.daysActive >= g.prevDaysActive ? 'Clipping back in — no miss left to recover from.' : 'A lighter stretch; the move now is clipping back in.',
    },
    {
      key: 'reach',
      label: 'Choice',
      fill: reach,
      threshold,
      passed: reach >= threshold,
      story: reclaimMoving > 0 ? `${reclaimMoving} goal${reclaimMoving === 1 ? '' : 's'} moving toward reclaimed.` : 'No goal moving yet — pick one to push.',
      gloss: 'The next call is yours.',
    },
  ];
}

/** Reflective, never a grade. */
export function grintaLine(daysActive: number, windowDays: number, identityNoun: string | null): string {
  if (daysActive === 0) return 'A fresh window. One small thing today gets it moving.';
  const noun = identityNoun ? `the ${identityNoun}` : 'the person you’re reclaiming';
  return `You’ve shown up ${daysActive} of the last ${windowDays} days. The reps are adding up — this is the work that brings ${noun} back.`;
}

export function computeGrinta(cur: GrintaInput, prev: GrintaInput, identityNoun: string | null): Grinta {
  const score = grintaScore(cur);
  const delta = score - grintaScore(prev);
  return {
    score,
    daysActive: cur.daysActive,
    prevDaysActive: prev.daysActive,
    windowDays: cur.windowDays,
    workouts: cur.workouts,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    delta,
    line: grintaLine(cur.daysActive, cur.windowDays, identityNoun),
  };
}

/** Gather the behavioral signals (current 14d vs the prior 14d, for the daily trend). */
export async function getGrinta(db: Db, memberId: string, identityNoun: string | null): Promise<Grinta> {
  const { rows } = await db.query<Record<string, number | string>>(
    `with ev as (
       select started_at  t, 'workout' kind from activity_event   where member_id=$1
       union all select occurred_at,  'program' from asset_event      where member_id=$1
       union all select completed_at, 'program' from asset_completion where member_id=$1
       union all select taken_at,     'other'   from idq_retake       where member_id=$1
       union all select created_at,   'other'   from agent_message    where member_id=$1 and role='member'
       union all select consumed_at,  'program' from bite_consumed     where member_id=$1
       union all select completed_at, 'program' from beat_completion   where member_id=$1 and close_response is distinct from 'onboarding'
     )
     select
       count(distinct date(t)) filter (where t >= now() - interval '14 days')                                          dac,
       count(distinct date(t)) filter (where t >= now() - interval '28 days' and t < now() - interval '14 days')       dap,
       count(*)                filter (where kind='workout' and t >= now() - interval '14 days')                       wc,
       count(*)                filter (where kind='workout' and t >= now() - interval '28 days' and t < now() - interval '14 days') wp,
       count(*)                filter (where kind='program' and t >= now() - interval '14 days')                       pc,
       count(*)                filter (where kind='program' and t >= now() - interval '28 days' and t < now() - interval '14 days') pp
     from ev`,
    [memberId],
  );
  const r = rows[0] ?? {};
  const cur: GrintaInput = { daysActive: Number(r.dac ?? 0), workouts: Number(r.wc ?? 0), programEvents: Number(r.pc ?? 0), windowDays: GRINTA_WINDOW_DAYS };
  const prev: GrintaInput = { daysActive: Number(r.dap ?? 0), workouts: Number(r.wp ?? 0), programEvents: Number(r.pp ?? 0), windowDays: GRINTA_WINDOW_DAYS };
  return computeGrinta(cur, prev, identityNoun);
}
