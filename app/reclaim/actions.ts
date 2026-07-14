'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState, ScaleExpectation, Turn } from '../../lib/agent/onboarding.ts';
import {
  reclaimEnabled,
  reclaimC1Opening,
  applyReclaimC1Turn,
  liveTurnReclaimRefine,
  reclaimC2Opening,
  applyReclaimC2Turn,
  reclaimC3Opening,
  liveTurnReclaimC3,
  reclaimCheckpointOpening,
  liveTurnReclaimCheckpoint,
} from '../../lib/agent/reclaim.ts';
import { getReclaimItems, liveReclaimTexts } from '../../lib/beats/store.ts';
import { commitRefinement, isTier, type Tier } from '../../lib/reclaim/refinement-store.ts';
import { persistBiggerWorldReading } from '../../lib/reclaim/bigger-world-store.ts';
import { AUDIT_ITEM_COUNT } from '../../lib/reclaim/bigger-world-instrument.ts';
import { persistQualityDayProfile } from '../../lib/reclaim/quality-day-store.ts';
import { startPracticeWeek } from '../../lib/practice/store.ts';
import { getGrintaBaselineReading, latestGrintaReading, persistGrintaReading, challengeCheckpointResponsesMap } from '../../lib/grinta/survey/store.ts';
import { scoreCheckpointStrand, grintaChangePct, directionOf } from '../../lib/grinta/survey/scoring.ts';
import { BASELINE_CHALLENGE_ITEMS, CHECKPOINT_CHALLENGE_ITEMS } from '../../lib/grinta/survey/instrument.ts';
import { setGate, markSessionClosed } from '../../lib/curriculum/store.ts';
import type { ReclaimCeremonyData } from '../../lib/ceremony/reclaim-ceremony-beats.ts';
import { earnedBadgeReveal } from '../../lib/ceremony/badge-reveal.ts';

// v2.5 Reclaim server actions. C1 · Readiness (evidence + refine→commit) + C2 · Bigger World Audit (administered →
// RC-1, persisted) + C3 · Quality Days (coach-define → store + open the logging week) + C4 · The Reclaim Checkpoint
// (administered Challenge read → the capstone ceremony → closes Cycle 1). Flag-gated (RECLAIM).
export type ReclaimSession = 'c1' | 'c2' | 'c3' | 'checkpoint';

export async function startReclaimAction(
  memberId: string,
  session: ReclaimSession = 'c1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; expects?: ScaleExpectation; error?: string }> {
  if (!reclaimEnabled()) return { ok: false, error: 'Reclaim is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  if (session === 'c2') return { ok: true, ...openTurn(reclaimC2Opening()) };
  if (session === 'c3') return { ok: true, ...openTurn(reclaimC3Opening()) };
  if (session === 'checkpoint') return { ok: true, ...openTurn(reclaimCheckpointOpening()) };
  // C1: seed the member's LIVE Reclaim List so Step 2 can present it for the re-read. Resilient (W-29): reads the
  // categorized rows and falls back to the committed jsonb list on reclaim_item drift — so the member NEVER sees
  // "your list is empty" when items actually exist (which would invite building a parallel list).
  const db = (await getDb()) as unknown as Db;
  const items = await liveReclaimTexts(db, memberId);
  return { ok: true, ...openTurn(reclaimC1Opening(items)) };
}

function openTurn(turn: Turn): { reply: string; state: ConvState; expects?: ScaleExpectation } {
  return { reply: turn.reply, state: turn.state, expects: turn.expects };
}

export async function reclaimTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
  session: ReclaimSession = 'c1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; expects?: ScaleExpectation; error?: string }> {
  if (!reclaimEnabled()) return { ok: false, error: 'Reclaim is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    // C4 · The Reclaim Checkpoint — administered (deterministic Likert). On the checkpoint→ceremony crossing it scores
    // the Challenge component + persists the reading + sets the capstone gate.
    if (session === 'checkpoint') {
      const turn = liveTurnReclaimCheckpoint(state, history, message);
      const db = (await getDb()) as unknown as Db;
      await persistReclaimCheckpoint(db, memberId, state, turn);
      return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
    }
    // C2 · Bigger World Audit — administered (deterministic 1–10). On completion, persist the durable priorities (RC-4).
    if (session === 'c2') {
      const turn = applyReclaimC2Turn(state, history, message);
      if (turn.complete) {
        const db = (await getDb()) as unknown as Db;
        const responses = (turn.state.administeredResponses ?? []).slice(0, AUDIT_ITEM_COUNT);
        if (responses.length === AUDIT_ITEM_COUNT) {
          try {
            await persistBiggerWorldReading(db, memberId, responses);
          } catch {
            /* swallow — the member saw the summary; the durable reading is best-effort */
          }
        }
        try {
          await markSessionClosed(db, memberId, 'RCL-C2');
        } catch {
          /* swallow — the forecast advance is best-effort */
        }
      }
      return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
    }
    // C3 · Quality Days — a LIVE coaching turn. On confirm, store the Quality-Day profile + open the logging week.
    if (session === 'c3') {
      const turn = await liveTurnReclaimC3(state, history, message);
      if (turn.complete && turn.state.collected?.pendingQualityDay) {
        const qd = turn.state.collected.pendingQualityDay;
        if (qd.nonNegotiables.length) {
          const db = (await getDb()) as unknown as Db;
          try {
            await persistQualityDayProfile(db, memberId, qd);
          } catch {
            /* swallow — the member saw the confirm; the stored profile is best-effort */
          }
          try {
            await startPracticeWeek(db, memberId, 'c3_quality');
          } catch {
            /* swallow — the logging nudge is a bonus */
          }
          try {
            await markSessionClosed(db, memberId, 'RCL-C3');
          } catch {
            /* swallow — the forecast advance is best-effort */
          }
        }
      }
      return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
    }
    // C1 · Step 1 (evidence) is administered (deterministic); Step 2 (refine) is the live coaching turn.
    const turn = state.stage === 'refine' ? await liveTurnReclaimRefine(state, history, message) : applyReclaimC1Turn(state, history, message);

    // On completion (the member confirmed the refinement) → COMMIT the snapshot to the live Reclaim List. Best-effort:
    // the member already saw the confirmation; a write hiccup never breaks the close.
    if (turn.complete) {
      const db = (await getDb()) as unknown as Db;
      const p = turn.state.collected?.pendingRefinement;
      const items = (p?.items ?? [])
        .filter((i) => isTier(i.tier))
        .map((i) => ({ original: i.original, text: i.text, tier: i.tier as Tier }));
      if (items.length && p) {
        try {
          await commitRefinement(db, memberId, { items, top3: p.top3 });
        } catch {
          /* swallow — the member saw the confirm; the commit is best-effort */
        }
      }
      try {
        await markSessionClosed(db, memberId, 'RCL-C1');
      } catch {
        /* swallow — the forecast advance is best-effort */
      }
    }
    return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}

// C4 — score the Challenge component (Ave1→Ave2) + persist the Checkpoint grinta_reading + set the capstone gate.
// Fires once, on the checkpoint→ceremony crossing. Best-effort (a write hiccup never breaks the ceremony). A clean 6
// (no pairwise). No new migration — writes the existing grinta_reading.
async function persistReclaimCheckpoint(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    if (prev.stage !== 'checkpoint' || turn.state.stage !== 'ceremony') return; // only on the completion crossing
    const challenge = (turn.state.administeredResponses ?? []).slice(0, CHECKPOINT_CHALLENGE_ITEMS.length);
    if (challenge.length < CHECKPOINT_CHALLENGE_ITEMS.length) return;
    const [base, latest] = await Promise.all([getGrintaBaselineReading(db, memberId), latestGrintaReading(db, memberId)]);
    const baselineValues = base
      ? BASELINE_CHALLENGE_ITEMS.map((c) => base.responses[c]).filter((v): v is number => v != null)
      : [];
    // Carry the OTHER strands from their LATEST means (they moved at the earlier checkpoints); fall back to baseline.
    const carried = {
      reconnect: latest?.strands.reconnect ?? base?.strands.reconnect,
      rewire: latest?.strands.rewire ?? base?.strands.rewire,
      rebuild: latest?.strands.rebuild ?? base?.strands.rebuild,
    };
    const cp = scoreCheckpointStrand({ target: 'reclaim', baselineValues, newValues: challenge, carriedStrands: carried });
    await persistGrintaReading(db, memberId, { source: 'checkpoint', responses: challengeCheckpointResponsesMap(challenge), score: cp.score });
    await setGate(db, memberId, 'reclaim_checkpoint_passed'); // the capstone — closes Cycle 1 (the Loop)
  } catch {
    // swallow — best-effort; the conversation turn already succeeded.
  }
}

// The C4 ceremony reveal data: the Challenge COMPONENT move (Ave1→Ave2, foregrounded) + the composite + the Playbook
// seeds (the priorities the member clarified — their top-tier Reclaim List items).
export async function reclaimCeremonyDataAction(memberId: string): Promise<{ ok: boolean; data?: ReclaimCeremonyData; error?: string }> {
  if (!reclaimEnabled()) return { ok: false, error: 'Reclaim is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const [latest, base, keepers] = await Promise.all([
      latestGrintaReading(db, memberId),
      getGrintaBaselineReading(db, memberId),
      loadReclaimCeremonyKeepers(db, memberId),
    ]);
    let grinta: ReclaimCeremonyData['grinta'] = null;
    if (latest && latest.strands.reclaim != null) {
      const now = latest.strands.reclaim; // the checkpoint's Challenge Ave2
      const baseline = base?.strands.reclaim ?? null; // Challenge Ave1 (the starting line)
      const changePct = grintaChangePct(now, baseline);
      grinta = { componentNow: now, componentBaseline: baseline, componentChangePct: changePct, direction: changePct == null ? null : directionOf(changePct), composite: latest.composite };
    }
    return { ok: true, data: { grinta, keepers, badge: earnedBadgeReveal('reclaim') } };
  } catch {
    return { ok: false, error: 'Could not load the ceremony.' };
  }
}

// The Playbook seeds — what the member clarified in Reclaim: their TOP-tier Reclaim List items (from C1's refinement),
// falling back to the first few list items if none are tiered. Best-effort; empty degrades to the fallback copy.
async function loadReclaimCeremonyKeepers(db: Db, memberId: string): Promise<string[]> {
  try {
    const items = await getReclaimItems(db, memberId);
    const top = items.filter((i) => i.tier === 'top').map((i) => i.text);
    return (top.length ? top : items.map((i) => i.text)).slice(0, 3);
  } catch {
    return [];
  }
}
