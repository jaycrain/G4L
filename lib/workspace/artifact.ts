// Redesign Layer 3 — the WORKSPACE artifact reader. The canvas shows "the work made visible": what the session is
// building, read back from committed state (never the chat client's private mid-turn state — we don't touch the arc
// engine). Polled by the client so it fills as the conversation commits.
//
// Two shapes, by session type:
//   • Draw-out / coach sessions (A/F) → a MEMBER-WORDS artifact (true lines, the vision, the pilot changes, the refined
//     Reclaim List, the Quality-Day profile) — the member's own language, played back.
//   • Administered / checkpoint sessions (B/E) → a governance-safe QUALITATIVE FRAME (never a bare number/score).

import { anchorFirst, isAnchorTier } from '../reclaim/anchor.ts';
import type { Db } from '../db/schema.ts';
import type { SessionKey } from './session-key.ts';
import { sessionById } from './session-registry.ts';
import { getDashboard } from '../gateway/flow.ts';
import { latestImageKeeper } from '../practice/store.ts';
import { activeCoachingPlan, type RebuildPilotPayload } from '../rebuild/plan-store.ts';
import { loadArcSession } from '../agent/arc-session.ts';
import { getReclaimItems } from '../beats/store.ts';
import { activeQualityDayProfile } from '../reclaim/quality-day-store.ts';
import type { SessionVisual } from '../agent/session-visual.ts';

export type ArtifactSlot = { label: string; value: string | null };
// `visual` is the revisit's picture slot (#163). A completed Session's revisit renders this card, not the
// conversation — so without a slot here, a Session that SHOWED a member something had no way to show it again.
export type Artifact = { title: string; lede: string; slots: ArtifactSlot[]; foot: string; visual?: SessionVisual };

const FOOT = 'You go one prompt at a time, at your own pace. Nothing here is scored — it lands in your Playbook.';
const FRAME_FOOT = 'This is a measure, not a test — an honest read at your own pace. Your Companion holds what it means.';

// Static frame (title + lede) per session. Slots are filled by the reader below (empty = the frame stands alone).
const META: Record<SessionKey, { title: string; lede: string; foot?: string }> = {
  // ONE FRAME PER RECONNECT SESSION (2026-08-28). The single entry described the whole phase, because the whole
  // phase was one session; each Session now has its own canvas naming what THAT Session produces.
  r1: { title: 'Your starting line', lede: 'The distance between where you are and the person you know yourself to be — measured once, honestly, so everything after has something to move against.', foot: FRAME_FOOT },
  r2: { title: 'The Doors you walked through', lede: 'The life events that opened the distance. Naming them is what turns a fog into a story you can work with.' },
  r3: { title: 'The spark, and the letter', lede: 'What the drift has cost, and the ordinary Tuesday you are writing yourself toward a year from now.' },
  r4: { title: 'Who you’re reclaiming', lede: 'What Reconnect brings into focus — in your words. It becomes the ground the whole program works from.' },
  w1: { title: 'The lines that beat the old voice', lede: 'Each excuse you turned into a truer line lands here — reach for one when the old voice gets loud.' },
  w2: { title: 'The picture you’re building', lede: 'The you a year from now, vivid enough the old voice can’t argue with it. It fills in your own words.' },
  w3: { title: 'Your way back in', lede: 'The move you reach for after a false start — not to avoid the slip, but to clip back in fast.' },
  b1: { title: 'Your Why', lede: 'The reason underneath the goal. You named it out loud — that’s what makes it carry when the how gets hard.', foot: FRAME_FOOT },
  b2: { title: 'Your strengths & starting points', lede: 'An honest read on where the body actually is — the skills that carry you and the ones still building.', foot: FRAME_FOOT },
  b3: { title: 'Your two changes', lede: 'Two small, real changes you chose — a week to live them, one day at a time.' },
  c1: { title: 'Your Reclaim List, refined', lede: 'The same list, seen through a more experienced you — what still matters most, what’s shifted, what’s newly clear.' },
  c2: { title: 'Your bigger world', lede: 'Where your world can widen — mapped, so the next reach has a direction.', foot: FRAME_FOOT },
  c3: { title: 'Your Quality Day', lede: 'What makes a day feel like you again — named, so you can build more of them.' },
  'rewire-checkpoint': { title: 'The Rewire Checkpoint', lede: 'You’ve walked all three. This is where your Grinta moves for the second time — an honest read, no studying.', foot: FRAME_FOOT },
  b4: { title: 'The Rebuild Checkpoint', lede: 'The body work, measured against where you started. Your Grinta moves again.', foot: FRAME_FOOT },
  c4: { title: 'The Transition', lede: 'Carrying it outward — your Success Story, and the door into the Community.', foot: FRAME_FOOT },
};

// Raw keeper bodies of one type (kept only), in order — the member's own committed words.
async function keeperBodies(db: Db, memberId: string, keeperType: string): Promise<string[]> {
  const { rows } = await db.query<{ body: string }>(
    `select body from playbook_entry where member_id=$1 and keeper_type=$2 and state='kept' order by sort_order, created_at`,
    [memberId, keeperType],
  );
  return rows.map((r) => r.body).filter(Boolean);
}

// Recover the two B3 changes from a Playbook 'plan' keeper body (composePilotPlan format: "Movement — X\nEating — Y").
// The fallback when the coaching_plan row is missing but the keeper survived. Exported for the test + the momentum read.
export function parsePilotPlanKeeper(bodies: string[]): { activity: string | null; diet: string | null } {
  for (const b of bodies) {
    const activity = /Movement\s+—\s+(.+)/.exec(b)?.[1]?.trim() || null;
    const diet = /Eating\s+—\s+(.+)/.exec(b)?.[1]?.trim() || null;
    if (activity || diet) return { activity, diet };
  }
  return { activity: null, diet: null };
}

const frame = (key: SessionKey): Artifact => {
  const m = META[key];
  return { title: m.title, lede: m.lede, slots: [], foot: m.foot ?? FOOT };
};

export async function readArtifact(db: Db, memberId: string, key: SessionKey): Promise<Artifact> {
  try {
    return await build(db, memberId, key);
  } catch {
    return frame(key); // any read hiccup → the frame stands alone, never a crash into the walk
  }
}

async function build(db: Db, memberId: string, key: SessionKey): Promise<Artifact> {
  const m = META[key] ?? { title: sessionById(key)?.label ?? 'Your session', lede: '' };
  const base = (slots: ArtifactSlot[], visual?: SessionVisual): Artifact => ({ title: m.title, lede: m.lede, slots, foot: m.foot ?? FOOT, ...(visual && { visual }) });

  switch (key) {
    case 'r1':
    case 'r2':
    case 'r3':
    case 'r4': {
      const dash = await getDashboard(db, memberId);
      const doors = dash?.doors.map((d) => d.displayName) ?? [];
      const items = dash?.reclaimItems.map((i) => i.text) ?? [];
      return base([
        { label: 'The self you’re reclaiming', value: dash?.identityNoun ? `the ${dash.identityNoun}` : null },
        { label: `The Door${doors.length > 1 ? 's' : ''} you named`, value: doors.length ? doors.join(' · ') : null },
        { label: 'Your Reclaim List', value: items.length ? items.join('\n') : null },
      ]);
    }
    case 'w1': {
      const lines = await keeperBodies(db, memberId, 'principle');
      return base([{ label: 'Your true lines', value: lines.length ? lines.join('\n') : null }]);
    }
    case 'w2': {
      const image = await latestImageKeeper(db, memberId);
      // Before the image COMMITS (one keeper, at the reveal), show what the member has named so far — the goal + each
      // scene piece — read live from the session, so the picture fills on the canvas as they build it (same as B3/C3).
      const pending = image ? null : (await loadArcSession(db, memberId, 'rewire', 'w2').catch(() => null))?.state.collected ?? null;
      const built = pending
        ? [pending.w2Anchor, ...(pending.w2Image ?? [])].map((s) => (s ?? '').trim()).filter(Boolean).join('\n')
        : '';
      return base([{ label: 'The picture, in your words', value: image ?? (built || null) }]);
    }
    case 'w3': {
      const moves = await keeperBodies(db, memberId, 'recovery_move');
      return base([{ label: 'Your clip-back-in move', value: moves.length ? moves.join('\n') : null }]);
    }
    case 'b3': {
      const plan = (await activeCoachingPlan<RebuildPilotPayload>(db, memberId, 'rebuild'))?.payload ?? null;
      // Before the plan COMMITS (on the member's confirm), show what the coach has already LOCKED, read from the live
      // session (arc_session) — so the two changes land on the canvas as they're named, not only after the final confirm.
      const pending = plan ? null : (await loadArcSession(db, memberId, 'rebuild', 'b3').catch(() => null))?.state.collected ?? null;
      let activity = plan?.activityChange ?? pending?.pilotActivity ?? null;
      let diet = plan?.dietChange ?? pending?.pilotDiet ?? null;
      // Defense-in-depth (Jay's walk: a completed B3 showed "Your two changes" BLANK). The B3 close persists the plan in
      // TWO independent best-effort writes — the coaching_plan AND a Playbook 'plan' keeper. If the coaching_plan write
      // is the one that failed, recover the changes from the keeper (composePilotPlan format) so the recap is never
      // empty when the data survived anywhere.
      if (!activity || !diet) {
        const fromKeeper = parsePilotPlanKeeper(await keeperBodies(db, memberId, 'plan').catch(() => []));
        activity = activity || fromKeeper.activity;
        diet = diet || fromKeeper.diet;
      }
      return base([
        { label: 'Your movement change', value: activity },
        { label: 'Your nutrition change', value: diet },
      ]);
    }
    case 'c1': {
      const items = await getReclaimItems(db, memberId);
      const line = (i: { text: string; tier?: string | null }) => (isAnchorTier(i.tier) ? `★ ${i.text}` : i.text);
      // THE ANCHOR LEADS. C1 exists to find the one thing the rest of the list organises itself around, and the card
      // was showing it in whatever position it happened to hold in the list — Jay's sat fourth. "Shouldn't the
      // starred item be on top. That was the whole point of Looking Forward." Naming the anchor and then burying it
      // undoes the Session on the very card that reports it.
      // Stable: only the starred ones move up; everything else keeps the order the member put it in.
      const kept = anchorFirst(items.filter((i) => i.tier !== 'no_longer_central'), (i) => isAnchorTier(i.tier));
      return base([{ label: 'What you’re taking back', value: kept.length ? kept.map(line).join('\n') : null }]);
    }
    case 'c3': {
      const p = await activeQualityDayProfile(db, memberId);
      // Before the profile COMMITS (on confirm), show what the coach has named so far, from the live session — so the
      // Quality Day fills on the canvas as it takes shape, not only after the final confirm (same as B3's pilot plan).
      const pending = p ? null : (await loadArcSession(db, memberId, 'reclaim', 'c3').catch(() => null))?.state.collected?.pendingQualityDay ?? null;
      const nn = p?.nonNegotiables ?? pending?.nonNegotiables ?? [];
      const lifts = p?.contributors ?? pending?.contributors ?? [];
      const drains = p?.disruptors ?? pending?.disruptors ?? [];
      return base([
        { label: 'Non-negotiables', value: nn.length ? nn.join('\n') : null },
        { label: 'What lifts a day', value: lifts.length ? lifts.join('\n') : null },
        { label: 'What drains one', value: drains.length ? drains.join('\n') : null },
      ]);
    }
    // Administered instruments + checkpoints (B/E): a qualitative frame — never a bare score (governance).
    case 'b1':
    case 'b2':
    case 'c2': {
      // THE REVISIT'S BARS — rebuilt from THAT RUN's own reading, not recomputed from anything current.
      // bigger_world_reading is append-only per sequence_no, so each C2 is its own row and a past run's picture is
      // a faithful snapshot rather than mutable history. That is why this can re-derive where the live turn stores.
      const { latestBiggerWorldReading } = await import('../reclaim/bigger-world-store.ts');
      const { priorityBarsVisual } = await import('../reclaim/bigger-world-scoring.ts');
      const reading = await latestBiggerWorldReading(db, memberId);
      return base([], reading?.priorities ? priorityBarsVisual(reading.priorities) : undefined);
    }
    case 'rewire-checkpoint':
    case 'b4':
    case 'c4':
      return frame(key);
  }
}
