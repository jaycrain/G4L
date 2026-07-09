'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState } from '../../lib/agent/onboarding.ts';
import { rebuildEnabled, rebuildB1Opening, liveTurnRebuildB1, rebuildB2Opening, liveTurnRebuildB2 } from '../../lib/agent/rebuild.ts';
import { persistWhyReading, persistSkillsReading } from '../../lib/rebuild/store.ts';
import { WHY_ITEM_COUNT } from '../../lib/rebuild/why-instrument.ts';
import { SKILLS_ITEM_COUNT } from '../../lib/rebuild/skills-instrument.ts';
import { startPracticeWeek } from '../../lib/practice/store.ts';

// v2.4 Rebuild server actions. B1 · "What is Your Why?" (SDT) + B2 · "Strengths & Weaknesses" (self-management) —
// both ADMINISTERED reads (deterministic Likert, no model call). Flag-gated (REBUILD). Conversation state is held
// client-side; on completion each scores + stores its profile. B2 also opens the skill-noticing practice week (Part
// B). The forecast/journey wiring is a later Rebuild slice.
export type RebuildSession = 'b1' | 'b2';

export async function startRebuildAction(
  memberId: string,
  session: RebuildSession = 'b1',
): Promise<{ ok: boolean; reply?: string; state?: ConvState; error?: string }> {
  if (!rebuildEnabled()) return { ok: false, error: 'Rebuild is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  const turn = session === 'b2' ? rebuildB2Opening() : rebuildB1Opening();
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
