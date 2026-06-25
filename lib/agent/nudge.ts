// Proactive nudges — what the Member Agent surfaces, signal-driven and gentle. Per
// docs/design/member-agent-companion.md: witness a win / catch a drift, never nag. The engine
// picks the single most relevant nudge from the member's real signals; it shows as the
// resting-bubble teaser (and could seed a push later). Frequency-capping across visits needs a
// nudge log (conversation persistence) — noted as a follow-up.

import type { Db } from '../db/schema.ts';
import { ASSET_NAMES } from '../assets/definitions.ts';
import { getDashboard } from '../gateway/flow.ts';
import { completedCodes } from '../assets/engine.ts';
import { recommendedNext } from '../assets/gating.ts';

export type NudgeSignals = {
  hasIdq: boolean;
  daysSinceLastIdq: number | null;
  recentAssetName: string | null;
  daysSinceRecentAsset: number | null;
  daysSinceActivity: number | null;
  direction: 'up' | 'down' | 'flat' | null;
  delta: number | null;
  nextAssetName: string | null;
  recentWorkoutType?: string | null; // a logged Strava activity (ride/run/walk…)
  daysSinceWorkout?: number | null;
  curriculumNext?: { title: string; kind: string } | null; // the lit, openable step on their path (Session/Checkpoint)
};

// A logged activity → a natural verb for the witness nudge.
const WORKOUT_VERB: Record<string, string> = {
  ride: 'ride',
  run: 'run',
  walk: 'walk',
  hike: 'hike',
  swim: 'swim',
  workout: 'workout',
  other: 'workout',
};

export type Nudge = { kind: string; text: string; priority: number };

/** All applicable nudges, highest priority first. Pure — easy to test/tune. */
export function computeNudges(s: NudgeSignals): Nudge[] {
  const n: Nudge[] = [];
  if (!s.hasIdq) {
    n.push({ kind: 'idq_baseline', text: 'Ready for your IDQ? It sets your baseline ID Score.', priority: 90 });
  } else if (s.daysSinceLastIdq != null && s.daysSinceLastIdq >= 60) {
    n.push({ kind: 'idq_due', text: 'Your IDQ is ready again — it shows how far you have come.', priority: 85 });
  }
  if (s.curriculumNext) {
    const c = s.curriculumNext;
    const text =
      c.kind === 'checkpoint'
        ? `Your ${c.title} Checkpoint is ready — cross it in your Program.`
        : `Your next Session, ${c.title}, is ready in your Program.`;
    n.push({ kind: 'curriculum_next', text, priority: 80 });
  }
  if (s.recentAssetName && s.daysSinceRecentAsset != null && s.daysSinceRecentAsset <= 3) {
    n.push({ kind: 'asset_reflect', text: `You finished ${s.recentAssetName}. Want to talk about how it landed?`, priority: 70 });
  }
  if (s.recentWorkoutType && s.daysSinceWorkout != null && s.daysSinceWorkout <= 3) {
    const verb = WORKOUT_VERB[s.recentWorkoutType] ?? 'workout';
    n.push({ kind: 'activity_witness', text: `Saw you got out for a ${verb}. How did it feel?`, priority: 65 });
  }
  if (s.daysSinceActivity != null && s.daysSinceActivity >= 10) {
    n.push({ kind: 'silence', text: 'It has been a little while. How are you feeling today?', priority: 60 });
  }
  if (s.direction === 'down') {
    n.push({ kind: 'down', text: 'Checking in — how are you doing this week?', priority: 50 });
  } else if (s.direction === 'up' && s.delta) {
    n.push({ kind: 'up', text: 'Your ID Score moved up. Want to talk about what is working?', priority: 45 });
  }
  if (s.nextAssetName) {
    n.push({ kind: 'next_asset', text: `Ready for ${s.nextAssetName}? Or just want to talk?`, priority: 30 });
  }
  n.push({ kind: 'default', text: "What's on your mind today?", priority: 10 });
  return n.sort((a, b) => b.priority - a.priority);
}

/** The single nudge to surface right now. */
export function topNudge(s: NudgeSignals): Nudge {
  return computeNudges(s)[0]!;
}

/** Assemble every signal for a member and return the one nudge to surface (dashboard + push). */
export async function buildNudge(db: Db, memberId: string): Promise<Nudge | null> {
  const dash = await getDashboard(db, memberId);
  if (!dash) return null;
  const completed = await completedCodes(db, memberId);
  const nextCode = recommendedNext({ completed, dimensions: dash.score?.dimensions });
  return topNudge({
    ...(await timeSignals(db, memberId)),
    direction: dash.score?.direction ?? null,
    delta: dash.score?.delta ?? null,
    nextAssetName: nextCode ? (ASSET_NAMES[nextCode] ?? null) : null,
  });
}

/** Gather the time-based signals from the warehouse (days computed in SQL, no JS clock). */
export async function timeSignals(
  db: Db,
  memberId: string,
): Promise<
  Pick<
    NudgeSignals,
    'hasIdq' | 'daysSinceLastIdq' | 'recentAssetName' | 'daysSinceRecentAsset' | 'daysSinceActivity' | 'recentWorkoutType' | 'daysSinceWorkout'
  >
> {
  const idq = (
    await db.query<{ n: number; days: number | null }>(
      `select count(*)::int n, floor(extract(epoch from (now()-max(taken_at)))/86400)::int as days
       from idq_retake where member_id=$1 and cycle_indicator=1`,
      [memberId],
    )
  ).rows[0]!;

  const asset = (
    await db.query<{ asset_code: string; days: number }>(
      `select asset_code, floor(extract(epoch from (now()-completed_at))/86400)::int as days
       from asset_completion where member_id=$1 order by completed_at desc limit 1`,
      [memberId],
    )
  ).rows[0];

  const activity = (
    await db.query<{ days: number | null }>(
      `select floor(extract(epoch from (now()-max(t)))/86400)::int as days from (
         select completed_at t from asset_completion where member_id=$1
         union all select taken_at from idq_retake where member_id=$1
         union all select occurred_at from asset_event where member_id=$1
         union all select started_at from activity_event where member_id=$1
       ) x`,
      [memberId],
    )
  ).rows[0]!;

  const workout = (
    await db.query<{ activity_type: string; days: number }>(
      `select activity_type, floor(extract(epoch from (now()-started_at))/86400)::int as days
       from activity_event where member_id=$1 order by started_at desc limit 1`,
      [memberId],
    )
  ).rows[0];

  return {
    hasIdq: idq.n > 0,
    daysSinceLastIdq: idq.days,
    recentAssetName: asset ? (ASSET_NAMES[asset.asset_code] ?? asset.asset_code) : null,
    daysSinceRecentAsset: asset ? asset.days : null,
    daysSinceActivity: activity.days,
    recentWorkoutType: workout ? workout.activity_type : null,
    daysSinceWorkout: workout ? workout.days : null,
  };
}
