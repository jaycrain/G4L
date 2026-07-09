'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState } from '../../lib/agent/onboarding.ts';
import {
  rebuildEnabled,
  rebuildB1Opening,
  liveTurnRebuildB1,
  rebuildB2Opening,
  liveTurnRebuildB2,
  rebuildB3Opening,
  liveTurnRebuildB3,
  composePilotPlan,
} from '../../lib/agent/rebuild.ts';
import { persistWhyReading, persistSkillsReading } from '../../lib/rebuild/store.ts';
import { persistCoachingPlan } from '../../lib/rebuild/plan-store.ts';
import { WHY_ITEM_COUNT } from '../../lib/rebuild/why-instrument.ts';
import { SKILLS_ITEM_COUNT } from '../../lib/rebuild/skills-instrument.ts';
import { startPracticeWeek } from '../../lib/practice/store.ts';
import { emitHarvestMoment, commitKeeper } from '../../lib/agent/harvest.ts';

// v2.4 Rebuild server actions. B1 (SDT) + B2 (self-management) are ADMINISTERED reads (deterministic, no model call);
// B3 · "The Lifestyle Pilot" is the LIVE coaching turn (COACH mode) → a confirmed plan. Flag-gated (REBUILD). On
// completion each persists its artifact; B2 opens the noticing week, B3 persists the coaching_plan + a plan keeper +
// opens the pilot logging week. The forecast/journey wiring is a later Rebuild slice.
export type RebuildSession = 'b1' | 'b2' | 'b3';

export async function startRebuildAction(
  memberId: string,
  session: RebuildSession = 'b1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!rebuildEnabled()) return { ok: false, error: 'Rebuild is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  const turn = session === 'b3' ? rebuildB3Opening() : session === 'b2' ? rebuildB2Opening() : rebuildB1Opening();
  return { ok: true, reply: turn.reply, state: turn.state };
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
    }
    return { ok: true, reply: turn.reply, state: turn.state };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
