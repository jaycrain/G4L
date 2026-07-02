// Reconnect (v2.2) — Cycle 1 sessions, config #2 on the shared arc kernel (runArcTurn). Spec of record:
// docs/handoffs/2026-07-02-v2.2-kernel-seam-and-sequenced-plan.md. This increment is the SKELETON + the
// callback (§2a) ONLY — the first real Reconnect behavior. The remaining beats (Doors excavation, the
// administered IDQ+Grinta measurement, Visioning, Checkpoint, the earned Ceremony) are declared stubs so the
// arc is walkable end-to-nowhere; nothing downstream runs. NOT wired to a live/DB path or UI yet — prod stays
// v1, both flags off, and per Jay's gate nothing executes until the callback is reviewed.
//
// DECISIONS baked in here:
//  • Own RECONNECT flag, entered from the dashboard (not auto-continued from onboarding) — reconnectEnabled().
//  • The callback is READ-ONLY: it READS the member's COMMITTED captures (never the transcript) and opens the
//    conversation. Any door/identity REVISION happens later in the Doors excavation (§2b/§3.3), member-confirmed
//    and versioned — so this increment is purely additive: it writes nothing.

import { DOORS, isDoorSlug, type DoorSlug } from '../doors.ts';
import { identityLabel } from '../member/identity.ts';
import type { Db } from '../db/schema.ts';
import { runArcTurn, type ArcConfig, type StageDef } from './onboarding-staged.ts';
import type { Collected, ConvMessage, ConvState, ModelTurn, Turn } from './onboarding.ts';

// Is the Reconnect arc selected? Own flag — defaults OFF, so it never runs in prod until the coupled v2.1+v2.2
// flip. (v2.1's ONBOARDING_ENGINE=staged is a separate flag; both go on together at cut-over.)
export function reconnectEnabled(): boolean {
  return process.env.RECONNECT === 'staged';
}

// --- the callback (§2a): a REVISABLE check that reads the committed captures, with graceful degrade ----------
// The opener is a pure function of what onboarding COMMITTED — identity, primary Door, gap — never the transcript.
// It picks up where onboarding left off and reframes it as revisable ("still where it began, or has it shifted?"),
// then hands into the deeper work. Graceful degrade: thin/null captures never fake continuity.
export function reconnectCallback(c: Collected): string {
  const identity = identityLabel(c.identityNoun); // "the Player", or '' if skipped
  // Onboarding captures the PRIMARY door(s) — one, several, or null (recognition, not routing; the full
  // 12-relevance SET is §2b's output, which doesn't exist yet). `c.doors` arrives primary-first. Reference the
  // primary by name; when a second was recognized, lightly acknowledge it — never silently drop one.
  const doorNames = (c.doors ?? [])
    .map((slug) => DOORS.find((d) => d.slug === slug)?.displayName)
    .filter((n): n is NonNullable<typeof n> => !!n);
  const gap = (c.gap ?? '').trim();

  if (doorNames.length > 0) {
    const [primary, ...others] = doorNames;
    const doorPhrase =
      others.length === 0
        ? primary
        : others.length === 1
          ? `${primary} — with ${others[0]} tangled up in it`
          : `${primary}, with a couple of others stacked on top`;
    // Richest path: a named Door → the revisable check lands on it by name.
    return (
      `${identity ? `Last time, we found who you're reclaiming — ${identity} — and it` : 'When we last talked, it'} ` +
      `felt like the distance started with ${doorPhrase}. Still where it feels like it began, or has something shifted ` +
      `since? Either way — this time, we go deeper.`
    );
  }
  if (gap) {
    // No Door tagged, but the gap story is in hand → open on the story, still revisable.
    return (
      `Last time, you started to tell me how the distance opened${identity ? ` from ${identity}` : ''}. ` +
      `I've been holding it. I want to go deeper into it with you now — does it still feel the way it did, or has it moved?`
    );
  }
  // Thin/null: don't fake continuity. A warm, honest cold-ish open into the deeper work.
  return (
    `Let's pick up where we left off${identity ? ` — ${identity} is who we're bringing back` : ''}. ` +
    `This time we go deeper into how the distance opened. No rush — start wherever it feels true.`
  );
}

// The Reconnect opening turn (parallels stagedOpening): the callback message + the arc's initial state, with the
// COMMITTED captures pre-loaded into `collected`. Stage 'entry' handles the member's response to the callback.
export function reconnectOpening(committed: Collected): Turn {
  return { reply: reconnectCallback(committed), state: { stage: 'entry', collected: committed }, complete: false };
}

// --- the live read: reconstruct the COMMITTED captures from member_profile (never the transcript) -----------
// Reads exactly what onboarding committed: the identity, the gap story (intake_gap), the primary Door(s) — the
// full recognized set from member_door, primary-first, falling back to named_door for legacy members — and the
// reclaim list (not used in the opener, but part of the captures the deeper beats will read). Read-only.
export async function loadReconnectCaptures(db: Db, memberId: string): Promise<Collected | null> {
  const m = (
    await db.query<{ identity_noun: string | null; named_door: string | null; intake_gap: string | null; reclaim_list: string[] | null }>(
      'select identity_noun, named_door, intake_gap, reclaim_list from member_profile where member_id = $1',
      [memberId],
    )
  ).rows[0];
  if (!m) return null;

  // The full recognized Door set, PRIMARY FIRST (recognition, not a routing set). Fall back to named_door.
  const doorRows = (
    await db.query<{ door_slug: string; is_primary: boolean }>(
      'select door_slug, is_primary from member_door where member_id = $1 order by is_primary desc, sort_order',
      [memberId],
    )
  ).rows;
  let doors: DoorSlug[] = doorRows.filter((r) => isDoorSlug(r.door_slug)).map((r) => r.door_slug as DoorSlug);
  if (doors.length === 0 && isDoorSlug(m.named_door)) doors = [m.named_door as DoorSlug];

  return {
    identityNoun: m.identity_noun ?? undefined,
    identitySkipped: !m.identity_noun, // no committed noun → named later at Identity Excavation
    doors,
    gap: m.intake_gap ?? '',
    reclaimList: Array.isArray(m.reclaim_list) ? m.reclaim_list : [],
  };
}

// --- RECONNECT_ARC (config #2) — entry/callback built; the rest declared as stubs -----------------------------

const RECONNECT_STUB_STAGES = ['doors', 'measurement', 'visioning', 'checkpoint', 'ceremony'] as const;

// A declared-but-unbuilt stage: it holds with a clear placeholder so a walk shows exactly where the built arc
// ends. Replaced beat-by-beat in later increments (Doors is next — §2b).
function stubStage(id: string): StageDef {
  const placeholder = `[Reconnect · ${id} — coming in a later increment]`;
  return {
    id,
    mode: 'drawout',
    opener: () => placeholder,
    offersSubstance: () => true,
    gather(b) {
      b.reply = placeholder;
    },
    confirm(b) {
      b.reply = placeholder;
    },
  };
}

// The callback stage. READ-ONLY: it acknowledges the member's response and hands into the Doors excavation. It
// writes nothing and never revises a capture — revision is owned by §2b, member-confirmed + versioned.
const reconnectEntryStage: StageDef = {
  id: 'entry',
  mode: 'drawout',
  opener: (c) => reconnectCallback(c),
  offersSubstance: (message) => message.trim().length >= 3,
  gather(b) {
    // The member answered the revisable check. This increment does not act on a revision (deferred to §2b) — it
    // acknowledges and hands into the Doors excavation (stubbed for now).
    b.stage = 'doors';
    b.reply = b.arc.stages.doors!.opener(b.collected);
  },
  confirm(b) {
    b.stage = 'doors';
    b.reply = b.arc.stages.doors!.opener(b.collected);
  },
};

export const RECONNECT_ARC: ArcConfig = {
  id: 'reconnect',
  stageOrder: ['entry', ...RECONNECT_STUB_STAGES],
  stages: {
    entry: reconnectEntryStage,
    ...Object.fromEntries(RECONNECT_STUB_STAGES.map((id) => [id, stubStage(id)])),
  },
  onComplete: () => '[Reconnect complete — the earned Threshold Ceremony lands in §2f]',
};

// The Reconnect turn — config #2 on the generic kernel. Public signature mirrors applyStagedTurn.
export function applyReconnectTurn(state: ConvState, history: ConvMessage[], memberMessage: string, model: ModelTurn): Turn {
  return runArcTurn(RECONNECT_ARC, state, history, memberMessage, model);
}
