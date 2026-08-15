// The Gateway flow engine — framework-free so it can be integration-tested headlessly and
// thinly wrapped by Next.js server actions. Onboarding -> IDQ -> dashboard, against any Db
// (local pglite now, hosted Supabase later). Governance + scoring + dosing wired in.

import { anchorFirst, isAnchorTier } from '../reclaim/anchor.ts';
import type { Db } from '../db/schema.ts';
import { writeAsActor } from '../db/actor.ts';
import type { AgentProvider, OnboardingInput } from '../agent/provider.ts';
import { DOORS, isDoorSlug, type DoorSlug } from '../doors.ts';
import { validateReconnectOutput } from '../member/reclaim.ts';
import { detectCrisis, CRISIS_RESPONSE_US, presentScore, type ScorePresentation } from '../agent/governance.ts';
import { cleanIdentityNoun, displayIdentityNoun } from '../member/identity.ts';
import { addReclaimItems, seedOnboardingBeats } from '../beats/store.ts';
import { harvestIdentityKeeper } from '../agent/harvest.ts';
import { inferCategory } from '../beats/category.ts';
import { isCategory, type Category } from '../beats/registry.ts';
import { categorizeReclaimItems } from '../beats/categorize.ts';
import { scoreIdq, computeMovement, type DimensionScores } from '../idq/scoring.ts';
import { listMeasures, type MeasureView } from '../measure/store.ts';
import { validateResponses, DIMENSIONS, type Dimension } from '../idq/instrument.ts';
import { logEvent } from '../telemetry/store.ts';

const doorName = (slug: DoorSlug) => DOORS.find((d) => d.slug === slug)!.displayName;

// --- Onboarding -------------------------------------------------------------------------
export type OnboardingFields = {
  displayName: string;
  email: string;
  doors: string[]; // zero or more Door slugs (first = primary); empty = null routing (Taxonomy Spec §1)
  identityNoun: string; // may be empty when identitySkipped is true
  identitySkipped?: boolean; // the member chose to name their reclaimed identity later (at Excavation)
  athleticPast: string;
  gap: string;
  reclaimList: string[]; // >= 3
  reclaimCategories?: string[]; // agent-inferred category per item (same order); heuristic fallback
};

export type OnboardingResult =
  | { ok: true; memberId: string }
  | { ok: false; crisis: true; message: string }
  | { ok: false; crisis?: false; code?: 'exists'; errors: string[] }; // code='exists' → the email is taken (route to login, don't dead-end)

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
  // Identity is required UNLESS the member chose to name it later (identitySkipped) — they'll surface it
  // at Identity Excavation. Recognition is still carried by their gap story. (Issue 1 identity gate.)
  if (!f.identityNoun?.trim() && !f.identitySkipped) errors.push('an identity noun is required');
  const doors = (f.doors ?? []).filter(isDoorSlug);
  // Reclaim List (>= 3) + any Doors present — the Reconnect contract. Doors are OPTIONAL (null routing,
  // Taxonomy Spec §1): a real Fade can complete with no Door, its recognition carried by the gap story.
  const rc = validateReconnectOutput({ reclaimList: f.reclaimList, doors, baselineIdScore: 0 });
  if (!rc.ok) errors.push(...rc.errors.filter((e) => !e.includes('baselineIdScore')));
  if (errors.length) return { ok: false, errors };

  const primaryDoor = doors[0] ?? null; // null routing is valid — member_profile.named_door is nullable
  const input: OnboardingInput = {
    displayName: f.displayName.trim(),
    door: primaryDoor,
    doorDisplayName: primaryDoor ? doorName(primaryDoor) : null,
    identityNoun: cleanIdentityNoun(f.identityNoun),
    athleticPast: f.athleticPast.trim(),
    gap: f.gap.trim(),
  };
  const identityParagraph = await provider.composeIdentityParagraph(input);

  try {
    const { rows } = await writeAsActor(db, 'member', (tx) =>
      tx.query<{ member_id: string }>(
        `insert into member_profile
         (display_name, email, named_door, identity_noun, identity_paragraph,
          intake_athletic_past, intake_gap, intake_right_now, reclaim_list, ai_consent_granted_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::text::jsonb, now())
       returning member_id`,
        // A SKIPPED identity persists as NULL (genuinely absent → recovered at Identity Excavation), never '' — so a
        // "never named" is distinguishable from a lost capture, and downstream reads treat it as absent cleanly.
        [input.displayName, f.email.trim(), primaryDoor, input.identityNoun ? displayIdentityNoun(input.identityNoun) : null, identityParagraph,
         input.athleticPast, input.gap, '', JSON.stringify(f.reclaimList)],
      ),
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
    // Reclaim List as categorized rows for the Beat engine.
    //
    // THE AGENT-INFERRED UPGRADE, FINALLY WIRED (2026-08-15). The comment here used to promise it "upgrades to
    // agent-inferred in the onboarding shaping conversation" — and the prompt does ask for it — but the Reclaim
    // List became a structured builder, and the builder sets every category to '' with the note "assigned
    // later". There was no later, so every list fell through to the v1 keyword heuristic. Caught when a persona
    // walk tagged an open-water swimmer's "Getting in the ocean regularly" as `self`: the keyword list has
    // `swim`, not `ocean`, and category selects the Beats she gets served.
    //
    // Only ask the model when something is actually missing — a list that arrived categorised (the tool-call
    // path) is already better than anything we would infer, and re-deriving it would be a second opinion
    // overwriting a first-hand one.
    //
    // WRAPPED AT THE SEAM, not trusted to the callee. categorizeReclaimItems catches its own failures — but a
    // guarantee this expensive ("a category can never cost a member their signup") must not rest on another
    // module's internal discipline, and its keyword fallback runs OUTSIDE that catch. A test proved the gap:
    // stub it to throw and runOnboarding rejects, so the member finishes onboarding and gets no account. The
    // consequence lives here, so the guard lives here.
    const cats = f.reclaimList.map((_, i) => f.reclaimCategories?.[i]);
    let resolved: Array<Category | undefined>;
    if (cats.every(isCategory)) {
      resolved = cats as Category[];
    } else {
      try {
        resolved = await categorizeReclaimItems(f.reclaimList);
      } catch (e) {
        console.warn('reclaim categorize threw at the seam — falling back to keywords:', (e as Error)?.message);
        resolved = [];
      }
    }
    await addReclaimItems(
      db,
      memberId,
      f.reclaimList.map((text, i) => ({ text, category: resolved[i] ?? inferCategory(text) })),
    );
    // Harvest the confirmed identity as a seed 'definition' keeper (v2.1 Increment 4 — light, opportunistic).
    // Best-effort: a harvest failure must never fail the signup; the captures above are already persisted.
    try {
      await harvestIdentityKeeper(db, memberId, {
        identityNoun: input.identityNoun,
        identitySkipped: f.identitySkipped,
        athleticPast: input.athleticPast,
      });
    } catch (e) {
      console.warn('onboarding harvest (identity keeper) failed — non-fatal:', (e as Error).message);
    }
    return { ok: true, memberId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if ((e as { code?: string })?.code === '23505' || /duplicate key|member_profile_email_active/i.test(msg)) {
      return { ok: false, code: 'exists', errors: ['An account with that email already exists. Try a different email.'] };
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
     values ($1,1,$2,$3::text::jsonb,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [memberId, sequenceNo, JSON.stringify(responses),
     score.dimensions.physical, score.dimensions.self, score.dimensions.social, score.dimensions.outlook,
     score.idScoreRaw, score.idScore,
     movement.deltaFromBaseline, movement.deltaFromPrevious, movement.direction],
  );
  await logEvent(db, memberId, 'idq_complete', { surface: 'idq', step: sequenceNo, meta: { idScore: score.idScore, sequenceNo } });
  // Baseline closes the Reconnect gateway → mark the onboarding-covered Beats done so the dashboard
  // opens at the next real work.
  if (sequenceNo === 0) await seedOnboardingBeats(db, memberId);
  return { ok: true, idScore: score.idScore, sequenceNo };
}

// --- Dosing v1 (rules-based current focus) ----------------------------------------------
// The lowest IDQ dimension points at where attention is dosed next (Decision Log Jun 9:
// Rewire = mind, Rebuild = body; "current focus", never "phase"). Rules-based to start;
// the agent applies it. Not a linear pipeline.
// Names the life AREA to focus on (the weakest IDQ dimension) — deliberately NOT prefixed with an
// R verb, since "Reconnect — your people" collided with Reconnect the gateway. The dimension key
// still drives dosing/gating; this is just the human label.
const FOCUS_BY_DIMENSION: Record<Dimension, string> = {
  physical: 'Your body',
  self: 'Your sense of self',
  outlook: 'Your outlook',
  social: 'Your people',
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
  reclaimList: string[]; // text only, ACTIVE items, ANCHOR FIRST (back-compat for the agent context + legacy reads)
  /** The `top`-tier item C1 named as the one the rest organises around, or null before/without a refinement. */
  reclaimAnchor: string | null;
  reclaimItems: { id: string | null; text: string; reclaimed: boolean; anchor: boolean }[]; // ACTIVE items (excludes "No Longer Central"), anchor first — every dashboard/hero/MA surface reads this
  releasedReclaimItems: { id: string | null; text: string; reclaimed: boolean }[]; // C1-refinement "No Longer Central" — kept + restorable, shown ONLY on the subpage, never among active priorities
  measures: MeasureView[]; // numbers the member watches; linked ones carry reclaimItemId
  score: (ScorePresentation & { dimensions: DimensionScores }) | null;
  currentFocus: { dimension: Dimension; label: string } | null;
};

export async function getDashboard(db: Db, memberId: string): Promise<Dashboard | null> {
  const m = (await db.query<any>(
    `select display_name, avatar_url, identity_noun, identity_paragraph, named_door, reclaim_list
     from member_profile where member_id=$1`, [memberId])).rows[0];
  if (!m) return null;

  // The full Door set; fall back to named_door for legacy members with no member_door rows.
  // Degrade-not-crash (W-13 class): getDashboard is the ESSENTIAL upstream of the cornerstone companion
  // (buildContext reads it BEFORE its own try/catch), so a supplementary read that rejects here would 500 the
  // whole rail. member_door is SUPPLEMENTARY — on a read failure, degrade to [] and let the named_door fallback
  // below carry the primary Door rather than taking the dashboard down.
  const doorRows = await db
    .query<any>(
      `select door_slug, is_primary from member_door where member_id=$1 order by sort_order, is_primary desc`,
      [memberId],
    )
    .then((r) => r.rows)
    .catch((e) => {
      console.warn('member_door read failed — degrading to named_door fallback:', (e as Error).message);
      return [] as any[];
    });
  let doors: DoorRef[] = doorRows
    .filter((r: any) => isDoorSlug(r.door_slug))
    .map((r: any) => ({ slug: r.door_slug, displayName: doorName(r.door_slug), isPrimary: r.is_primary === true }));
  if (doors.length === 0 && isDoorSlug(m.named_door)) {
    doors = [{ slug: m.named_door, displayName: doorName(m.named_door), isPrimary: true }];
  }
  const primary = doors.find((d) => d.isPrimary) ?? doors[0] ?? null;

  // Reclaim List now lives as categorized rows (reclaim_item); fall back to the legacy jsonb. Guarded: the
  // removed_at column is migration 0040 — if a drifted DB lacks it (or the table), degrade to the jsonb list
  // instead of crashing the whole dashboard.
  const riRows = await db
    .query<{ id: string; text: string; state: string; tier: string | null }>(
      'select id, text, state, tier from reclaim_item where member_id=$1 and removed_at is null order by sort_order, created_at',
      [memberId],
    )
    .then((r) => r.rows)
    .catch((e) => {
      console.warn('reclaim_item read failed — migration 0040 (removed_at) unapplied?', (e as Error).message);
      return [] as { id: string; text: string; state: string; tier: string | null }[];
    });
  // Split ACTIVE from "No Longer Central" (the C1-refinement release tier). Releasing an item is never a delete — the
  // row is kept + restorable — but a released item must NOT sit among active priorities on the dashboard (Jay's walk:
  // "we eliminated these in the Session, they still showed at the bottom"). The Session's own summary already filters it
  // out (workspace/artifact); this makes every dashboard/hero/MA surface match. The subpage surfaces the released set.
  const allItems = riRows.length
    ? riRows.map((r) => ({ id: r.id, text: r.text, reclaimed: r.state === 'reclaimed', released: r.tier === 'no_longer_central', anchor: isAnchorTier(r.tier) }))
    // The legacy jsonb list predates tiers entirely, so nothing in it can be an anchor — false, not a guess.
    : (Array.isArray(m.reclaim_list) ? (m.reclaim_list as string[]) : []).map((text) => ({ id: null, text, reclaimed: false, released: false, anchor: false }));
  // `anchor` RIDES ALONG. This projection used to drop the tier here after using it to compute `released`, which
  // is why the anchor was invisible on the Reclaim List subpage and to the Companion — both read this object, and
  // the one bit of the C1 refinement that says which item leads was thrown away one line before they got it.
  const reclaimItems = anchorFirst(
    allItems.filter((i) => !i.released).map(({ id, text, reclaimed, anchor }) => ({ id, text, reclaimed, anchor })),
    (i) => i.anchor,
  );
  const releasedReclaimItems = allItems.filter((i) => i.released).map(({ id, text, reclaimed }) => ({ id, text, reclaimed }));
  // Anchor-first, because this is the ordering every downstream reader inherits — including the Companion's
  // reclaimList and the offline opening line, which names item [0].
  const reclaimList = reclaimItems.map((i) => i.text);
  const reclaimAnchor = reclaimItems.find((i) => i.anchor)?.text ?? null;
  // Measures + score are SUPPLEMENTARY to the dashboard hero (name + identity + doors + reclaim list render
  // without them). Guard both so a drifted/transient read degrades — measures → [], score → null — instead of
  // crashing the dashboard (and, through buildContext, the companion). Both are null-safe downstream.
  const measures = await listMeasures(db, memberId).catch((e) => {
    console.warn('listMeasures read failed — degrading to no measures:', (e as Error).message);
    return [] as MeasureView[];
  });

  const latest = await db
    .query<any>(
      `select id_score, physical_score, self_score, social_score, outlook_score,
            delta_from_baseline, delta_from_previous, direction
     from idq_retake where member_id=$1 and cycle_indicator=1
     order by sequence_no desc limit 1`,
      [memberId],
    )
    .then((r) => r.rows[0])
    .catch((e) => {
      console.warn('idq_retake read failed — degrading to no score:', (e as Error).message);
      return undefined;
    });

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
    reclaimAnchor,
    reclaimItems,
    releasedReclaimItems,
    measures,
    score,
    currentFocus: focus,
  };
}
