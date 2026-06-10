// The Gateway flow engine — framework-free so it can be integration-tested headlessly and
// thinly wrapped by Next.js server actions. Onboarding -> IDQ -> dashboard, against any Db
// (local pglite now, hosted Supabase later). Governance + scoring + dosing wired in.

import type { Db } from '../db/schema.ts';
import type { AgentProvider, OnboardingInput } from '../agent/provider.ts';
import { DOORS, isDoorSlug, type DoorSlug } from '../doors.ts';
import { validateReconnectOutput } from '../member/reclaim.ts';
import { detectCrisis, CRISIS_RESPONSE_US, presentScore, type ScorePresentation } from '../agent/governance.ts';
import { cleanIdentityNoun, displayIdentityNoun } from '../member/identity.ts';
import { addReclaimItems, seedOnboardingBeats } from '../beats/store.ts';
import { inferCategory } from '../beats/category.ts';
import { isCategory } from '../beats/registry.ts';
import { scoreIdq, computeMovement, type DimensionScores } from '../idq/scoring.ts';
import { validateResponses, DIMENSIONS, type Dimension } from '../idq/instrument.ts';

const doorName = (slug: DoorSlug) => DOORS.find((d) => d.slug === slug)!.displayName;

// --- Onboarding -------------------------------------------------------------------------
export type OnboardingFields = {
  displayName: string;
  email: string;
  doors: string[]; // one or more Door slugs (first = primary)
  identityNoun: string;
  athleticPast: string;
  gap: string;
  reclaimList: string[]; // >= 3
  reclaimCategories?: string[]; // agent-inferred category per item (same order); heuristic fallback
};

export type OnboardingResult =
  | { ok: true; memberId: string }
  | { ok: false; crisis: true; message: string }
  | { ok: false; crisis?: false; errors: string[] };

export async function runOnboarding(
  db: Db,
  provider: AgentProvider,
  f: OnboardingFields,
): Promise<OnboardingResult> {
  // Governance first: scan free-text for distress before anything else (Emotional Safety).
  for (const text of [f.athleticPast, f.gap]) {
    if (detectCrisis(text ?? '').flagged) {
      return { ok: false, crisis: true, message: CRISIS_RESPONSE_US };
    }
  }

  const errors: string[] = [];
  if (!f.displayName?.trim()) errors.push('name is required');
  if (!f.email?.trim()) errors.push('email is required');
  if (!f.identityNoun?.trim()) errors.push('an identity noun is required');
  const doors = (f.doors ?? []).filter(isDoorSlug);
  // Reclaim List (>= 3) + Door(s) — the Reconnect contract (baseline score added at IDQ).
  const rc = validateReconnectOutput({ reclaimList: f.reclaimList, doors, baselineIdScore: 0 });
  if (!rc.ok) errors.push(...rc.errors.filter((e) => !e.includes('baselineIdScore')));
  if (errors.length) return { ok: false, errors };

  const primaryDoor = doors[0]!;
  const input: OnboardingInput = {
    displayName: f.displayName.trim(),
    door: primaryDoor,
    doorDisplayName: doorName(primaryDoor),
    identityNoun: cleanIdentityNoun(f.identityNoun),
    athleticPast: f.athleticPast.trim(),
    gap: f.gap.trim(),
  };
  const identityParagraph = await provider.composeIdentityParagraph(input);

  try {
    const { rows } = await db.query<{ member_id: string }>(
      `insert into member_profile
         (display_name, email, named_door, identity_noun, identity_paragraph,
          intake_athletic_past, intake_gap, intake_right_now, reclaim_list, ai_consent_granted_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb, now())
       returning member_id`,
      [input.displayName, f.email.trim(), primaryDoor, displayIdentityNoun(input.identityNoun), identityParagraph,
       input.athleticPast, input.gap, '', f.reclaimList],
    );
    const memberId = rows[0]!.member_id;
    // The full Door set (named_door above is kept as the primary for single-value reads).
    for (let i = 0; i < doors.length; i++) {
      await db.query(
        `insert into member_door (member_id, door_slug, is_primary, sort_order)
         values ($1,$2,$3,$4) on conflict (member_id, door_slug) do nothing`,
        [memberId, doors[i], i === 0, i],
      );
    }
    // Reclaim List as categorized rows for the Beat engine (category v1: keyword-inferred;
    // upgrades to agent-inferred in the onboarding shaping conversation).
    await addReclaimItems(
      db,
      memberId,
      f.reclaimList.map((text, i) => {
        const agentCat = f.reclaimCategories?.[i];
        return { text, category: isCategory(agentCat) ? agentCat : inferCategory(text) };
      }),
    );
    return { ok: true, memberId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if ((e as { code?: string })?.code === '23505' || /duplicate key|member_profile_email_active/i.test(msg)) {
      return { ok: false, errors: ['An account with that email already exists. Try a different email.'] };
    }
    throw e;
  }
}

// --- IDQ submission ---------------------------------------------------------------------
export type IdqResult =
  | { ok: true; idScore: number; sequenceNo: number }
  | { ok: false; errors: string[] };

export async function submitIdq(db: Db, memberId: string, responses: number[]): Promise<IdqResult> {
  const v = validateResponses(responses);
  if (!v.ok) return { ok: false, errors: v.errors };

  const score = scoreIdq(responses);

  // sequence_no: 0 for baseline, then incrementing per cycle.
  const prev = await db.query<{ id_score: string; sequence_no: number }>(
    'select id_score, sequence_no from idq_retake where member_id=$1 and cycle_indicator=1 order by sequence_no desc',
    [memberId],
  );
  const sequenceNo = prev.rows.length ? prev.rows[0]!.sequence_no + 1 : 0;
  const baseline = prev.rows.length ? Number(prev.rows[prev.rows.length - 1]!.id_score) : null;
  const previous = prev.rows.length ? Number(prev.rows[0]!.id_score) : null;
  const movement = computeMovement(score.idScore, baseline, previous);

  await db.query(
    `insert into idq_retake
       (member_id, cycle_indicator, sequence_no, responses,
        physical_score, self_score, social_score, outlook_score, id_score_raw, id_score,
        delta_from_baseline, delta_from_previous, direction)
     values ($1,1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [memberId, sequenceNo, responses,
     score.dimensions.physical, score.dimensions.self, score.dimensions.social, score.dimensions.outlook,
     score.idScoreRaw, score.idScore,
     movement.deltaFromBaseline, movement.deltaFromPrevious, movement.direction],
  );
  // Baseline closes the Reconnect gateway → mark the onboarding-covered Beats done so the dashboard
  // opens at the next real work.
  if (sequenceNo === 0) await seedOnboardingBeats(db, memberId);
  return { ok: true, idScore: score.idScore, sequenceNo };
}

// --- Dosing v1 (rules-based current focus) ----------------------------------------------
// The lowest IDQ dimension points at where attention is dosed next (Decision Log Jun 9:
// Rewire = mind, Rebuild = body; "current focus", never "phase"). Rules-based to start;
// the agent applies it. Not a linear pipeline.
const FOCUS_BY_DIMENSION: Record<Dimension, string> = {
  physical: 'Rebuild — your body',
  self: 'Rewire — your sense of self',
  outlook: 'Rewire — your outlook',
  social: 'Reconnect — your people',
};

export function currentFocus(dims: DimensionScores): { dimension: Dimension; label: string } {
  let lowest: Dimension = DIMENSIONS[0];
  for (const d of DIMENSIONS) if (dims[d] < dims[lowest]) lowest = d;
  return { dimension: lowest, label: FOCUS_BY_DIMENSION[lowest] };
}

// --- Dashboard read ---------------------------------------------------------------------
export type DoorRef = { slug: string; displayName: string; isPrimary: boolean };
export type Dashboard = {
  displayName: string;
  avatarUrl: string | null;
  identityNoun: string | null;
  identityParagraph: string | null;
  door: { slug: string; displayName: string } | null; // primary (back-compat single-value reads)
  doors: DoorRef[]; // the full set, primary first
  reclaimList: string[];
  score: (ScorePresentation & { dimensions: DimensionScores }) | null;
  currentFocus: { dimension: Dimension; label: string } | null;
};

export async function getDashboard(db: Db, memberId: string): Promise<Dashboard | null> {
  const m = (await db.query<any>(
    `select display_name, avatar_url, identity_noun, identity_paragraph, named_door, reclaim_list
     from member_profile where member_id=$1`, [memberId])).rows[0];
  if (!m) return null;

  // The full Door set; fall back to named_door for legacy members with no member_door rows.
  const doorRows = (await db.query<any>(
    `select door_slug, is_primary from member_door where member_id=$1 order by sort_order, is_primary desc`,
    [memberId])).rows;
  let doors: DoorRef[] = doorRows
    .filter((r: any) => isDoorSlug(r.door_slug))
    .map((r: any) => ({ slug: r.door_slug, displayName: doorName(r.door_slug), isPrimary: r.is_primary === true }));
  if (doors.length === 0 && isDoorSlug(m.named_door)) {
    doors = [{ slug: m.named_door, displayName: doorName(m.named_door), isPrimary: true }];
  }
  const primary = doors.find((d) => d.isPrimary) ?? doors[0] ?? null;

  // Reclaim List now lives as categorized rows (reclaim_item); fall back to the legacy jsonb.
  const riRows = (
    await db.query<{ text: string }>('select text from reclaim_item where member_id=$1 order by sort_order, created_at', [memberId])
  ).rows;
  const reclaimList = riRows.length
    ? riRows.map((r) => r.text)
    : Array.isArray(m.reclaim_list)
      ? m.reclaim_list
      : [];

  const latest = (await db.query<any>(
    `select id_score, physical_score, self_score, social_score, outlook_score,
            delta_from_baseline, delta_from_previous, direction
     from idq_retake where member_id=$1 and cycle_indicator=1
     order by sequence_no desc limit 1`, [memberId])).rows[0];

  let score: Dashboard['score'] = null;
  let focus: Dashboard['currentFocus'] = null;
  if (latest) {
    const dims: DimensionScores = {
      physical: latest.physical_score, self: latest.self_score,
      social: latest.social_score, outlook: latest.outlook_score,
    };
    const delta = latest.delta_from_previous ?? latest.delta_from_baseline;
    score = {
      ...presentScore(Number(latest.id_score), latest.direction ?? null, delta === null ? null : Number(delta)),
      dimensions: dims,
    };
    focus = currentFocus(dims);
  }

  return {
    displayName: m.display_name,
    avatarUrl: m.avatar_url ?? null,
    identityNoun: m.identity_noun ? displayIdentityNoun(m.identity_noun) : null,
    identityParagraph: m.identity_paragraph,
    door: primary ? { slug: primary.slug, displayName: primary.displayName } : null,
    doors,
    reclaimList,
    score,
    currentFocus: focus,
  };
}
