// Redesign Layer 3 — the WORKSPACE artifact reader. The canvas shows "the work made visible": what the session is
// building, read back from committed state (never the chat client's private mid-turn state — we don't touch the arc
// engine). Polled by the client so it fills as the conversation commits.
//
// Two shapes, by session type:
//   • Draw-out / coach sessions (A/F) → a MEMBER-WORDS artifact (true lines, the vision, the pilot changes, the refined
//     Reclaim List, the Quality-Day profile) — the member's own language, played back.
//   • Administered / checkpoint sessions (B/E) → a governance-safe QUALITATIVE FRAME (never a bare number/score).

import type { Db } from '../db/schema.ts';
import type { SessionKey } from './session-key.ts';
import { sessionById } from './session-registry.ts';
import { getDashboard } from '../gateway/flow.ts';
import { latestImageKeeper } from '../practice/store.ts';
import { activeCoachingPlan, type RebuildPilotPayload } from '../rebuild/plan-store.ts';
import { loadArcSession } from '../agent/arc-session.ts';
import { getReclaimItems } from '../beats/store.ts';
import { activeQualityDayProfile } from '../reclaim/quality-day-store.ts';

export type ArtifactSlot = { label: string; value: string | null };
export type Artifact = { title: string; lede: string; slots: ArtifactSlot[]; foot: string };

const FOOT = 'You go one prompt at a time, at your own pace. Nothing here is scored — it lands in your Playbook.';
const FRAME_FOOT = 'This is a measure, not a test — an honest read at your own pace. Your Companion holds what it means.';

// Static frame (title + lede) per session. Slots are filled by the reader below (empty = the frame stands alone).
const META: Record<SessionKey, { title: string; lede: string; foot?: string }> = {
  reconnect: { title: 'Who you’re reclaiming', lede: 'What Reconnect brings into focus — in your words. It becomes the ground the whole program works from.' },
  w1: { title: 'The lines that beat the old voice', lede: 'Each excuse you turned into a truer line lands here — yours to reach for when the old voice gets loud.' },
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
  const base = (slots: ArtifactSlot[]): Artifact => ({ title: m.title, lede: m.lede, slots, foot: m.foot ?? FOOT });

  switch (key) {
    case 'reconnect': {
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
      return base([{ label: 'The picture, in your words', value: image ?? null }]);
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
      return base([
        { label: 'Your movement change', value: plan?.activityChange ?? pending?.pilotActivity ?? null },
        { label: 'Your nutrition change', value: plan?.dietChange ?? pending?.pilotDiet ?? null },
      ]);
    }
    case 'c1': {
      const items = await getReclaimItems(db, memberId);
      const line = (i: { text: string; tier?: string | null }) => (i.tier === 'top' ? `★ ${i.text}` : i.text);
      const kept = items.filter((i) => i.tier !== 'no_longer_central');
      return base([{ label: 'What you’re taking back', value: kept.length ? kept.map(line).join('\n') : null }]);
    }
    case 'c3': {
      const p = await activeQualityDayProfile(db, memberId);
      return base([
        { label: 'Non-negotiables', value: p?.nonNegotiables.length ? p.nonNegotiables.join('\n') : null },
        { label: 'What lifts a day', value: p?.contributors.length ? p.contributors.join('\n') : null },
        { label: 'What drains one', value: p?.disruptors.length ? p.disruptors.join('\n') : null },
      ]);
    }
    // Administered instruments + checkpoints (B/E): a qualitative frame — never a bare score (governance).
    case 'b1':
    case 'b2':
    case 'c2':
    case 'rewire-checkpoint':
    case 'b4':
    case 'c4':
      return frame(key);
  }
}
