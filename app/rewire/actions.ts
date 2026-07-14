'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState, ScaleExpectation, Turn } from '../../lib/agent/onboarding.ts';
import {
  rewireEnabled,
  rewireOpening,
  liveTurnRewire,
  rewireW2Opening,
  liveTurnRewireW2,
  rewireW3Opening,
  liveTurnRewireW3,
  rewireCheckpointOpening,
  liveTurnRewireCheckpoint,
  type W3Callback,
} from '../../lib/agent/rewire.ts';
import { loadReconnectCaptures } from '../../lib/agent/reconnect.ts';
import { emitHarvestMoment, commitKeeper, type KeeperType } from '../../lib/agent/harvest.ts';
import { startPracticeWeek, latestImageKeeper } from '../../lib/practice/store.ts';
import { getGrintaBaselineReading, latestGrintaReading, persistGrintaReading, commitmentCheckpointResponsesMap } from '../../lib/grinta/survey/store.ts';
import { scoreCheckpointStrand, grintaChangePct, directionOf } from '../../lib/grinta/survey/scoring.ts';
import { BASELINE_COMMITMENT_ITEMS, CHECKPOINT_COMMITMENT_ITEMS } from '../../lib/grinta/survey/instrument.ts';
import { setGate, markSessionClosed } from '../../lib/curriculum/store.ts';
import { acknowledgeSessionBadge } from '../../lib/curriculum/view.ts';
import type { RewireCeremonyData } from '../../lib/ceremony/rewire-ceremony-beats.ts';
import { earnedBadgeReveal } from '../../lib/ceremony/badge-reveal.ts';

// Which Rewire session — W1/W2/W3 (the three Sessions) or the R4 'checkpoint' (the administered Commitment read →
// ceremony). All ride the same flag + surface; W2 reads the Reclaim List, W3 pulls W1/W2 keepers forward, the
// checkpoint scores the Commitment component + lights Rebuild.
export type RewireSession = 'w1' | 'w2' | 'w3' | 'checkpoint';

// The member's W1 true lines (principle keepers) — pulled forward at the W3 Reframe. Graceful degrade to [] if none.
async function loadTrueLines(db: Db, memberId: string): Promise<string[]> {
  try {
    return (
      await db.query<{ body: string }>(
        `select body from playbook_entry where member_id=$1 and state='kept' and keeper_type='principle' order by created_at`,
        [memberId],
      )
    ).rows.map((r) => r.body);
  } catch {
    return [];
  }
}

// v2.3 Rewire server actions (W1 · the Disinformation Audit). Flag-gated (REWIRE). Conversation state is held
// client-side for the walk; the true lines the member writes are harvested to the Playbook (default-emit,
// member-owned) as they land. No captures are read for W1 (W2's callback to the Reconnect Spark arrives later).

export async function startRewireAction(
  memberId: string,
  session: RewireSession = 'w1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; expects?: ScaleExpectation; error?: string }> {
  if (!rewireEnabled()) return { ok: false, error: 'Rewire is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  if (session === 'w2') {
    // W2 opens on the Reclaim List (the callback seam) — read the committed captures; graceful degrade if null/thin.
    const db = (await getDb()) as unknown as Db;
    const committed = await loadReconnectCaptures(db, memberId);
    const turn = rewireW2Opening(committed);
    return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
  }
  if (session === 'w3') {
    // W3 pulls the prior tools FORWARD — the W1 true lines + the W2 image — plus grounding. Graceful degrade to [].
    const db = (await getDb()) as unknown as Db;
    const [committed, trueLines, image] = await Promise.all([
      loadReconnectCaptures(db, memberId),
      loadTrueLines(db, memberId),
      latestImageKeeper(db, memberId).catch(() => null),
    ]);
    const cb: W3Callback = {
      trueLines,
      image: image ?? undefined,
      reclaimList: committed?.reclaimList ?? [],
      identityNoun: committed?.identityNoun,
    };
    const turn = rewireW3Opening(cb);
    return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
  }
  if (session === 'checkpoint') {
    const turn = rewireCheckpointOpening();
    return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
  }
  const turn = rewireOpening();
  return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
}

// R4 — score the Commitment component (Ave1→Ave2) + persist the Checkpoint grinta_reading + light Rebuild. Fires once,
// on the checkpoint→ceremony crossing. Best-effort (a write hiccup never breaks the ceremony). Component change is
// recomputed at the ceremony from the readings; here we persist the reading + set the gate.
async function persistRewireCheckpoint(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    if (prev.stage !== 'checkpoint' || turn.state.stage !== 'ceremony') return; // only on the completion crossing
    const commitment = (turn.state.administeredResponses ?? []).slice(0, CHECKPOINT_COMMITMENT_ITEMS.length);
    if (commitment.length < CHECKPOINT_COMMITMENT_ITEMS.length) return;
    const [base, latest] = await Promise.all([getGrintaBaselineReading(db, memberId), latestGrintaReading(db, memberId)]);
    const baselineValues = base
      ? BASELINE_COMMITMENT_ITEMS.map((c) => base.responses[c]).filter((v): v is number => v != null)
      : [];
    // Carry the OTHER strands from their LATEST means (reconnect may have moved at §2e); fall back to the baseline.
    const carried = { reconnect: latest?.strands.reconnect ?? base?.strands.reconnect, rebuild: latest?.strands.rebuild ?? base?.strands.rebuild, reclaim: latest?.strands.reclaim ?? base?.strands.reclaim };
    const cp = scoreCheckpointStrand({ target: 'rewire', baselineValues, newValues: commitment, carriedStrands: carried });
    await persistGrintaReading(db, memberId, { source: 'checkpoint', responses: commitmentCheckpointResponsesMap(commitment), score: cp.score });
    await setGate(db, memberId, 'rewire_checkpoint_passed'); // → activePhaseIndex 2 (Rebuild is now "You're here")
  } catch {
    // swallow — best-effort; the conversation turn already succeeded.
  }
}

// The R4 ceremony reveal data: the Commitment COMPONENT move (Ave1→Ave2, foregrounded) + the composite (background) +
// the three tools (keepers). Recomputes the component change from the readings (persist stores the COMPOSITE change).
export async function rewireCeremonyDataAction(memberId: string): Promise<{ ok: boolean; data?: RewireCeremonyData; error?: string }> {
  if (!rewireEnabled()) return { ok: false, error: 'Rewire is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const [latest, base, keepers] = await Promise.all([
      latestGrintaReading(db, memberId),
      getGrintaBaselineReading(db, memberId),
      loadCeremonyKeepers(db, memberId),
    ]);
    let grinta: RewireCeremonyData['grinta'] = null;
    if (latest && latest.strands.rewire != null) {
      const now = latest.strands.rewire; // the checkpoint's Commitment Ave2
      const baseline = base?.strands.rewire ?? null; // Commitment Ave1 (the starting line)
      const changePct = grintaChangePct(now, baseline);
      grinta = { componentNow: now, componentBaseline: baseline, componentChangePct: changePct, direction: changePct == null ? null : directionOf(changePct), composite: latest.composite };
    }
    return { ok: true, data: { grinta, keepers, badge: earnedBadgeReveal('rewire') } };
  } catch {
    return { ok: false, error: 'Could not load the ceremony.' };
  }
}

// The three tools revealed together — the W1 true line (principle), the W2 image (lights_you_up), the W3 protocol
// (recovery_move), in a stable reveal order. Best-effort; missing ones are simply skipped (graceful degrade).
async function loadCeremonyKeepers(db: Db, memberId: string): Promise<string[]> {
  try {
    const pick = async (type: string) =>
      (await db.query<{ body: string }>(`select body from playbook_entry where member_id=$1 and state='kept' and keeper_type=$2 order by created_at desc limit 1`, [memberId, type])).rows[0]?.body ?? null;
    const [line, image, protocol] = await Promise.all([pick('principle'), pick('lights_you_up'), pick('recovery_move')]);
    return [line, image, protocol].filter((x): x is string => !!x);
  } catch {
    return [];
  }
}

// Drain the NEW harvest signals this turn (the true lines) → a member_event moment + a kept Playbook entry in the
// member's own words. Best-effort: a harvest hiccup never fails the conversation turn.
async function persistRewireHarvest(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    const priorN = prev.pendingHarvest?.length ?? 0;
    for (const s of (turn.state.pendingHarvest ?? []).slice(priorN)) {
      const momentId = await emitHarvestMoment(db, memberId, {
        destinationIntent: s.destinationIntent,
        keeperType: s.keeperType as KeeperType,
        surface: 'rewire',
        sourceRef: { kind: s.kind, ref: s.kind, label: s.label ?? s.kind },
        payloadRef: s.payloadRef,
        private: s.private,
      });
      if (s.destinationIntent !== 'share' && !s.private) {
        await commitKeeper(db, memberId, {
          momentId,
          keeperType: s.keeperType as KeeperType,
          section: 'own_words',
          body: s.payloadRef,
          state: 'kept',
          source: { kind: 'own', ref: s.kind, label: s.label ?? s.kind },
        });
      }
    }
  } catch {
    // swallow — best-effort; the conversation turn already succeeded.
  }
}

export async function rewireTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
  session: RewireSession = 'w1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; expects?: ScaleExpectation; error?: string; earnedBadge?: { id: string; name: string } | null }> {
  if (!rewireEnabled()) return { ok: false, error: 'Rewire is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    // The R4 checkpoint is ADMINISTERED (deterministic Likert parse) — no model call. On the checkpoint→ceremony
    // crossing it scores the Commitment component + persists the reading + lights Rebuild.
    if (session === 'checkpoint') {
      const turn = liveTurnRewireCheckpoint(state, history, message);
      const db = (await getDb()) as unknown as Db;
      await persistRewireCheckpoint(db, memberId, state, turn);
      return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
    }
    // Every session turn is a live model turn — the model supplies the reflection; the kernel sequences + harvests.
    const turn =
      session === 'w3'
        ? await liveTurnRewireW3(state, history, message)
        : session === 'w2'
          ? await liveTurnRewireW2(state, history, message)
          : await liveTurnRewire(state, history, message);
    const db = (await getDb()) as unknown as Db;
    await persistRewireHarvest(db, memberId, state, turn); // true lines / image / protocol → Playbook keepers
    // On completion: (1) mark the Session CLOSED so the curriculum forecast advances the member W1→W2→W3→Checkpoint
    // (the v2.3 conversational sessions complete via the kernel, not the step player); (2) open the practice week
    // (Decision MM R4). Both best-effort — a hiccup never fails the conversation turn.
    let earnedBadge: { id: string; name: string } | null = null;
    if (turn.complete) {
      const assetId = session === 'w1' ? 'RWR-W1' : session === 'w2' ? 'RWR-W2' : session === 'w3' ? 'RWR-W3' : null;
      if (assetId) {
        try {
          await markSessionClosed(db, memberId, assetId);
          earnedBadge = await acknowledgeSessionBadge(db, memberId, assetId); // newly-earned milestone → the Companion names it at the close
        } catch {
          /* swallow — the session still completed for the member; the forecast advance is best-effort */
        }
      }
      if (session === 'w2' || session === 'w3') {
        try {
          await startPracticeWeek(db, memberId, session === 'w3' ? 'w3_logging' : 'w2_image');
        } catch {
          /* swallow — the session still completed; the nudge is a bonus, not load-bearing */
        }
      }
    }
    return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects, earnedBadge };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
