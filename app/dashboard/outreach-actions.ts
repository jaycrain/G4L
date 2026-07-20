'use server';

// The in-app outreach surface's server actions (Slice 1, OUTREACH-flagged). Two calls the card makes:
//   fetchReadyOutreach — run the FULL governed engine (or return an already-ready nudge) → the card renders it
//   respondToOutreach  — record the member's dismiss/reply (feeds cadence back-off); a live reply inherits 988
// Everything is gated by outreachEnabled() + authorizeMember; failures degrade to "no nudge", never throw to the UI.

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { detectCrisis } from '../../lib/agent/governance.ts';
import { outreachEnabled } from '../../lib/outreach/config.ts';
import { loadContext } from '../../lib/outreach/context.ts';
import { gatherSources } from '../../lib/outreach/sources.ts';
import { generateOutreach } from '../../lib/agent/outreach.ts';
import { nextOutreach, type OutreachDeps } from '../../lib/outreach/engine.ts';
import { getOpenOutreach, markResponded } from '../../lib/outreach/store.ts';
import type { Db } from '../../lib/db/schema.ts';

export type ReadyOutreach = { id: string; text: string } | null;

const DEPS: OutreachDeps = { loadContext, gatherSources, generate: generateOutreach };

/** A governed, ready-to-show nudge for this member — or null. Idempotent: an unanswered nudge re-shows, never re-generates. */
export async function fetchReadyOutreach(memberId: string): Promise<ReadyOutreach> {
  if (!outreachEnabled()) return null;
  if (!(await authorizeMember(memberId))) return null;
  try {
    const db = (await getDb()) as unknown as Db;
    const open = await getOpenOutreach(db, memberId);
    if (open) return { id: open.id, text: open.message };
    const r = await nextOutreach(db, memberId, 'morning_presence', new Date(), DEPS);
    return r.status === 'ready' ? { id: r.id, text: r.draft.text } : null;
  } catch (e) {
    console.error('fetchReadyOutreach failed:', (e as Error).message);
    return null;
  }
}

export type RespondResult = { ok: boolean; crisis?: boolean; resource?: string };

/** Record the member's response. dismiss → cadence back-off; reply → reset. A live reply routes distress to 988. */
export async function respondToOutreach(
  memberId: string,
  id: string,
  kind: 'dismissed' | 'replied',
  replyText?: string,
): Promise<RespondResult> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  try {
    const db = (await getDb()) as unknown as Db;
    // A reply is live member input — it inherits crisis routing like every other agent surface (kernel 988).
    if (kind === 'replied' && replyText && detectCrisis(replyText).flagged) {
      await markResponded(db, memberId, id, 'replied');
      return { ok: true, crisis: true, resource: '988' };
    }
    await markResponded(db, memberId, id, kind);
    return { ok: true };
  } catch (e) {
    console.error('respondToOutreach failed:', (e as Error).message);
    return { ok: false };
  }
}
