'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState, Turn } from '../../lib/agent/onboarding.ts';
import {
  rebuildEnabled,
  rebuildB1Opening,
  liveTurnRebuildB1,
  rebuildB2Opening,
  liveTurnRebuildB2,
  rebuildB3Opening,
  liveTurnRebuildB3,
  composePilotPlan,
  rebuildCheckpointOpening,
  liveTurnRebuildCheckpoint,
} from '../../lib/agent/rebuild.ts';
import { persistWhyReading, persistSkillsReading } from '../../lib/rebuild/store.ts';
import { persistCoachingPlan } from '../../lib/rebuild/plan-store.ts';
import { WHY_ITEM_COUNT } from '../../lib/rebuild/why-instrument.ts';
import { SKILLS_ITEM_COUNT } from '../../lib/rebuild/skills-instrument.ts';
import { startPracticeWeek } from '../../lib/practice/store.ts';
import { emitHarvestMoment, commitKeeper } from '../../lib/agent/harvest.ts';
import { getGrintaBaselineReading, latestGrintaReading, persistGrintaReading, controlCheckpointResponsesMap } from '../../lib/grinta/survey/store.ts';
import { scoreCheckpointStrand, grintaChangePct, directionOf } from '../../lib/grinta/survey/scoring.ts';
import { BASELINE_CONTROL_ITEMS, CHECKPOINT_CONTROL_ITEMS, pairwiseAverage } from '../../lib/grinta/survey/instrument.ts';
import { setGate, markSessionClosed } from '../../lib/curriculum/store.ts';
import type { RebuildCeremonyData } from '../../lib/ceremony/rebuild-ceremony-beats.ts';

// v2.4 Rebuild server actions. B1 (SDT) + B2 (self-management) are ADMINISTERED reads; B3 · "The Lifestyle Pilot" is
// the LIVE coaching turn (COACH mode) → a confirmed plan; B4 · "The Rebuild Checkpoint" is the administered Control
// read → the earned ceremony (lights Reclaim). Flag-gated (REBUILD). On completion each persists its artifact.
export type RebuildSession = 'b1' | 'b2' | 'b3' | 'checkpoint';

export async function startRebuildAction(
  memberId: string,
  session: RebuildSession = 'b1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!rebuildEnabled()) return { ok: false, error: 'Rebuild is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  const turn =
    session === 'checkpoint'
      ? rebuildCheckpointOpening()
      : session === 'b3'
        ? rebuildB3Opening()
        : session === 'b2'
          ? rebuildB2Opening()
          : rebuildB1Opening();
  return { ok: true, reply: turn.reply, state: turn.state };
}

// B4 — pairwise-average the 12 control responses → 6, score the Control component (Ave1→Ave2), persist the Checkpoint
// grinta_reading + light Reclaim. Fires once, on the checkpoint→ceremony crossing. Best-effort (a write hiccup never
// breaks the ceremony). The component change is recomputed at the ceremony from the readings.
async function persistRebuildCheckpoint(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    if (prev.stage !== 'checkpoint' || turn.state.stage !== 'ceremony') return; // only on the completion crossing
    const control = (turn.state.administeredResponses ?? []).slice(0, CHECKPOINT_CONTROL_ITEMS.length);
    if (control.length < CHECKPOINT_CONTROL_ITEMS.length) return;
    const [base, latest] = await Promise.all([getGrintaBaselineReading(db, memberId), latestGrintaReading(db, memberId)]);
    const baselineValues = base
      ? BASELINE_CONTROL_ITEMS.map((c) => base.responses[c]).filter((v): v is number => v != null)
      : [];
    // Carry the OTHER strands from their LATEST means (they may have moved at §2e / R4); fall back to the baseline.
    const carried = {
      reconnect: latest?.strands.reconnect ?? base?.strands.reconnect,
      rewire: latest?.strands.rewire ?? base?.strands.rewire,
      reclaim: latest?.strands.reclaim ?? base?.strands.reclaim,
    };
    const scored = pairwiseAverage(control); // 12 → 6 (the one B4 factory addition)
    const cp = scoreCheckpointStrand({ target: 'rebuild', baselineValues, newValues: scored, carriedStrands: carried });
    await persistGrintaReading(db, memberId, { source: 'checkpoint', responses: controlCheckpointResponsesMap(control), score: cp.score });
    await setGate(db, memberId, 'rebuild_checkpoint_passed'); // → activePhaseIndex 3 (Reclaim is now "You're here")
  } catch {
    // swallow — best-effort; the conversation turn already succeeded.
  }
}

// The B4 ceremony reveal data: the Control COMPONENT move (Ave1→Ave2, foregrounded) + the composite + the Playbook
// seeds (the pilot plan). Recomputes the component change from the readings (persist stores the COMPOSITE change).
export async function rebuildCeremonyDataAction(memberId: string): Promise<{ ok: boolean; data?: RebuildCeremonyData; error?: string }> {
  if (!rebuildEnabled()) return { ok: false, error: 'Rebuild is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const [latest, base, keepers] = await Promise.all([
      latestGrintaReading(db, memberId),
      getGrintaBaselineReading(db, memberId),
      loadRebuildCeremonyKeepers(db, memberId),
    ]);
    let grinta: RebuildCeremonyData['grinta'] = null;
    if (latest && latest.strands.rebuild != null) {
      const now = latest.strands.rebuild; // the checkpoint's Control Ave2
      const baseline = base?.strands.rebuild ?? null; // Control Ave1 (the starting line)
      const changePct = grintaChangePct(now, baseline);
      grinta = { componentNow: now, componentBaseline: baseline, componentChangePct: changePct, direction: changePct == null ? null : directionOf(changePct), composite: latest.composite };
    }
    return { ok: true, data: { grinta, keepers } };
  } catch {
    return { ok: false, error: 'Could not load the ceremony.' };
  }
}

// The Playbook seeds revealed at the Rebuild ceremony — the member's pilot plan (their two small changes). Best-effort;
// missing keepers are simply skipped (graceful degrade → the empty-Playbook fallback copy).
async function loadRebuildCeremonyKeepers(db: Db, memberId: string): Promise<string[]> {
  try {
    const plan = (
      await db.query<{ body: string }>(
        `select body from playbook_entry where member_id=$1 and state='kept' and keeper_type='plan' order by created_at desc limit 1`,
        [memberId],
      )
    ).rows[0]?.body ?? null;
    return [plan].filter((x): x is string => !!x);
  } catch {
    return [];
  }
}

export async function rebuildTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
  session: RebuildSession = 'b1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!rebuildEnabled()) return { ok: false, error: 'Rebuild is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    // B4 is ADMINISTERED (deterministic Likert parse) — no model call. On the checkpoint→ceremony crossing it scores
    // the Control component + persists the reading + lights Reclaim.
    if (session === 'checkpoint') {
      const turn = liveTurnRebuildCheckpoint(state, history, message);
      const db = (await getDb()) as unknown as Db;
      await persistRebuildCheckpoint(db, memberId, state, turn);
      return { ok: true, reply: turn.reply, state: turn.state };
    }
    // B3 is a LIVE coaching turn (COACH mode — the model coaches, the engine holds the completeness contract).
    if (session === 'b3') {
      const turn = await liveTurnRebuildB3(state, history, message);
      if (turn.complete) {
        const activity = (turn.state.collected?.pilotActivity ?? '').trim();
        const diet = (turn.state.collected?.pilotDiet ?? '').trim();
        const db = (await getDb()) as unknown as Db;
        if (activity && diet) {
          // Persist the plan artifact (coaching_plan) + a Playbook keeper (§5 — the two small changes, their words).
          try {
            await persistCoachingPlan(db, memberId, 'rebuild', { activityChange: activity, dietChange: diet });
          } catch {
            /* swallow — best-effort; the member still committed their plan */
          }
          try {
            const body = composePilotPlan(activity, diet);
            const momentId = await emitHarvestMoment(db, memberId, {
              destinationIntent: 'keeper',
              keeperType: 'plan',
              surface: 'rebuild',
              sourceRef: { kind: 'plan', ref: 'b3', label: 'Your Lifestyle Pilot' },
              payloadRef: body,
              private: false,
            });
            await commitKeeper(db, memberId, {
              momentId,
              keeperType: 'plan',
              section: 'own_words',
              body,
              state: 'kept',
              source: { kind: 'own', ref: 'b3', label: 'Your Lifestyle Pilot' },
            });
          } catch {
            /* swallow — the plan is stored; the Playbook keeper is best-effort */
          }
        }
        // Open the pilot logging week (Part B) — the plan-aware daily nudge rides the practice-week scaffold.
        try {
          await startPracticeWeek(db, memberId, 'b3_pilot');
        } catch {
          /* swallow — the logging nudge is a bonus, not load-bearing */
        }
        // Mark B3 closed so the v2.4 forecast advances the member B3 → B4 (best-effort).
        try {
          await markSessionClosed(db, memberId, 'RBLD-B3');
        } catch {
          /* swallow — the session still completed; the forecast advance is best-effort */
        }
      }
      return { ok: true, reply: turn.reply, state: turn.state };
    }
    // Both B1 and B2 are ADMINISTERED (deterministic Likert parse) — no model call needed.
    const turn = session === 'b2' ? liveTurnRebuildB2(state, history, message) : liveTurnRebuildB1(state, history, message);
    if (turn.complete) {
      const responses = turn.state.administeredResponses ?? [];
      const db = (await getDb()) as unknown as Db;
      if (session === 'b2') {
        // Score the 24 responses → the self-management profile → store it. Then open the skill-noticing practice week
        // (Part B). Both best-effort — a write hiccup never breaks the member's close.
        const r = responses.slice(0, SKILLS_ITEM_COUNT);
        if (r.length === SKILLS_ITEM_COUNT) {
          try {
            await persistSkillsReading(db, memberId, r);
          } catch {
            /* swallow — the member still completed B2; the stored reading is best-effort */
          }
        }
        try {
          await startPracticeWeek(db, memberId, 'b2_noticing');
        } catch {
          /* swallow — the noticing nudge is a bonus, not load-bearing */
        }
      } else {
        // B1: score the 12 responses → the SDT profile → store it (RB-1: stored, not displayed).
        const r = responses.slice(0, WHY_ITEM_COUNT);
        if (r.length === WHY_ITEM_COUNT) {
          try {
            await persistWhyReading(db, memberId, r);
          } catch {
            /* swallow — the member still completed B1; the stored reading is best-effort */
          }
        }
      }
      // Mark the Session closed so the v2.4 forecast advances the member (B1 → B2 → B3). Best-effort.
      try {
        await markSessionClosed(db, memberId, session === 'b2' ? 'RBLD-B2' : 'RBLD-B1');
      } catch {
        /* swallow — the session still completed; the forecast advance is best-effort */
      }
    }
    return { ok: true, reply: turn.reply, state: turn.state };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
