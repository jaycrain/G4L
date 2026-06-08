// Founder Agent auto-triggers — a member event drafts a Founder note automatically, into Jay's
// review queue. GOVERNANCE: this only ever DRAFTS. Nothing sends without Jay's review (the
// approve/send gate in store.ts is untouched). Auto-triggering fills the queue; the human gate
// stays. Every step is wrapped so a draft failure never affects the member's own action
// (graceful degradation), and each event drafts at most once (trigger_key dedupe).

import type { Db } from '../db/schema.ts';
import { generateDraft, type OperatingMoment } from './draft.ts';
import { createDraft, draftExistsForTrigger } from './store.ts';
import { buildFounderContext } from './context.ts';

export type FounderEvent =
  | { kind: 'idq'; sequenceNo: number } // 0 = baseline, >0 = retake
  | { kind: 'milestone'; assetCode: string; assetName: string };

/** Map a member event to the operating moment + a stable idempotency key. Pure. */
export function selectTrigger(e: FounderEvent): { moment: OperatingMoment; triggerKey: string } | null {
  switch (e.kind) {
    case 'idq':
      return {
        moment: e.sequenceNo === 0 ? 'post_idq_welcome' : 'retake_commentary',
        triggerKey: `idq:${e.sequenceNo}`,
      };
    case 'milestone':
      return { moment: 'milestone_commentary', triggerKey: `milestone:${e.assetCode}` };
  }
}

/**
 * Draft a Founder note for this event, unless one already exists for it. Returns the new draft
 * id, or null (already drafted, member not found, or any failure — never throws to the caller).
 */
export async function maybeTriggerDraft(db: Db, memberId: string, e: FounderEvent): Promise<string | null> {
  try {
    const sel = selectTrigger(e);
    if (!sel) return null;
    if (await draftExistsForTrigger(db, memberId, sel.triggerKey)) return null;
    const ctx = await buildFounderContext(db, memberId, {
      lastCompletedAsset: e.kind === 'milestone' ? e.assetName : null,
    });
    if (!ctx) return null;
    const draft = await generateDraft(sel.moment, ctx);
    return await createDraft(db, {
      memberId,
      moment: sel.moment,
      draft,
      inputSnapshot: ctx,
      triggerKey: sel.triggerKey,
    });
  } catch (err) {
    console.warn('founder auto-trigger (non-fatal):', (err as Error).message);
    return null;
  }
}
