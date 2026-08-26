import type { Db } from '../db/schema.ts';
import type { ConvState } from './onboarding.ts';
import { stageStep, type ArcConfig } from './onboarding-staged.ts';
import { markFurthestStep } from '../curriculum/store.ts';
import { REBUILD_B1_ARC, REBUILD_B2_ARC, REBUILD_B3_ARC, REBUILD_CHECKPOINT_ARC } from './rebuild.ts';
import { REWIRE_ARC, REWIRE_W2_ARC, REWIRE_W3_ARC, REWIRE_CHECKPOINT_ARC } from './rewire.ts';
import { RECLAIM_C1_ARC, RECLAIM_C2_ARC, RECLAIM_C3_ARC, RECLAIM_CHECKPOINT_ARC } from './reclaim.ts';

// WHERE THE MEMBER GOT TO — the drop-off measure, recorded once per turn.
//
// CLAUDE.md has listed "drop-off point" as a required telemetry event since day one. On 2026-08-26 it did not
// exist. `session_progress.current_step` has been in the schema since migration 0023 with a `greatest()` on
// conflict so it can only move forward, but its only writer is `saveAnswer` — part of the old step-based
// curriculum flow that no conversational Session calls. Jay's eleven completed Sessions all read `current_step:
// 1`. Meanwhile the diagnostic's `furthest_step_by_session` read a different source entirely (`member_event` rows
// with both `step` and `ref`), and the single call site that writes `step` passes no `ref` — so that field could
// never populate for any member. Two dead paths to one question.
//
// WHY IT MATTERS NOW rather than later: Jay walked Reconnect at 65 minutes and ruled "I wouldn't cut ANY of the
// content", making it an expectations problem instead of a length one. Whether that judgement is right is exactly
// what drop-off measures, and Charter is the cohort that would tell us. Without this, a member who abandons at
// the Legacy Letter and one who abandons on the first question are the same row.
//
// THE MAP IS HERE, IN ONE PLACE. Each arc action already carries its own private session→asset-id map, and the
// comment on curriculumIdFor warns that adding a third copy is how the pair drifts. This module holds the
// session→ARC map — the one thing that was not yet written down anywhere — so the four call sites stay a single
// line each and no phase can quietly invent its own idea of progress.
const ARCS: Record<string, ArcConfig> = {
  'RWR-W1': REWIRE_ARC, 'RWR-W2': REWIRE_W2_ARC, 'RWR-W3': REWIRE_W3_ARC, 'RWR-CHK': REWIRE_CHECKPOINT_ARC,
  'RBLD-B1': REBUILD_B1_ARC, 'RBLD-B2': REBUILD_B2_ARC, 'RBLD-B3': REBUILD_B3_ARC, 'RBLD-B4': REBUILD_CHECKPOINT_ARC,
  'RCL-C1': RECLAIM_C1_ARC, 'RCL-C2': RECLAIM_C2_ARC, 'RCL-C3': RECLAIM_C3_ARC, 'RCL-C4': RECLAIM_CHECKPOINT_ARC,
};

/** Every asset id this module can measure — exported so a test can hold it against the curriculum. */
export const MEASURED_ASSET_IDS = Object.keys(ARCS);

/** How far in, and how far is all the way. `of: 0` means the Session has no fixed length (a coaching arc). */
export type SessionPosition = { step: number; of: number; unit: 'item' | 'stage' | 'turn' };

/**
 * HOW FAR IN, AND HOW FAR IS ALL THE WAY — in the unit that Session actually has.
 *
 * THE STAGE INDEX ALONE WOULD HAVE BEEN A SECOND DEAD FIELD, which a test caught before this shipped. Five of the
 * twelve arcs have exactly ONE stage — B1, B2, B3, C1, C3 — so their "furthest stage" is 1 the moment a member
 * says anything, and 1 forever after. Those are precisely the Sessions where drop-off matters most: B1 and B2 are
 * 12- and 24-item instruments, the long grinds someone abandons halfway. A measure that reads 1 for a member who
 * quit on item 2 and 1 for a member who finished all 24 is the same lie the old field told, in a new column.
 *
 * So the unit follows the Session. An administered instrument counts ITEMS ANSWERED, because that is its real
 * progress; a conversational arc counts STAGES. Both come back with their denominator, because "step 9" means
 * nothing on its own and a bare number in a report is how a measure gets misread later.
 */
export function sessionPosition(assetId: string, state: ConvState, turns = 0): SessionPosition | null {
  const arc = ARCS[assetId];
  if (!arc) return null;
  const idx = stageStep(arc, state.stage);
  if (idx < 1) return null;
  const stage = arc.stages[arc.stageOrder[idx - 1]!];
  // Items only where the instrument IS the whole Session. In a multi-stage arc an item count and a stage index
  // would fight over the same column, and the stage is the coarser, safer answer.
  if (arc.stageOrder.length === 1 && stage?.mode === 'administered' && stage.scale?.itemCount) {
    return { step: state.administeredResponses?.length ?? 0, of: stage.scale.itemCount, unit: 'item' };
  }
  // A SINGLE-STAGE COACHING ARC HAS NEITHER — B3, C1 and C3 run one open-ended conversation, so a stage index is
  // 1 from the first reply to the last and measures nothing. Their honest unit is TURNS TAKEN, with no
  // denominator: the Session ends when the coach gate closes, not at a known count. `of: 0` says "unbounded" out
  // loud rather than inventing a target a member could be read as failing to reach.
  if (arc.stageOrder.length === 1) return { step: turns, of: 0, unit: 'turn' };
  return { step: idx, of: arc.stageOrder.length, unit: 'stage' };
}

/** The denominator for every measured Session — so a reader of `current_step` can interpret it. */
export function sessionTotals(): Record<string, { of: number; unit: SessionPosition['unit'] }> {
  const out: Record<string, { of: number; unit: SessionPosition['unit'] }> = {};
  for (const [id, arc] of Object.entries(ARCS)) {
    const first = arc.stages[arc.stageOrder[0]!];
    if (arc.stageOrder.length === 1) {
      out[id] = first?.mode === 'administered' && first.scale?.itemCount
        ? { of: first.scale.itemCount, unit: 'item' }
        : { of: 0, unit: 'turn' }; // unbounded — a coaching conversation has no item count to be short of
      continue;
    }
    out[id] = { of: arc.stageOrder.length, unit: 'stage' };
  }
  return out;
}

/**
 * Record how far into `assetId` the member has reached.
 *
 * Best-effort by construction: an unknown asset or an unknown stage records NOTHING rather than guessing a
 * position, because a wrong step is worse than a missing one — it reads as a member who stopped somewhere they
 * never were. The write itself swallows and logs (telemetry must never break a save).
 */
export async function recordFurthestStep(db: Db, memberId: string, assetId: string, state: ConvState, turns = 0): Promise<void> {
  const pos = sessionPosition(assetId, state, turns);
  if (!pos || pos.step < 1) return;
  await markFurthestStep(db, memberId, assetId, pos.step);
}
