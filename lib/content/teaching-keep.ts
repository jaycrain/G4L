// ④ KEEP — commit the Session's science takeaway to the Playbook.
//
// One read per Session, not one per point (Rev 1, after Donna flagged that per-line keeping was ~63 decisions a
// cycle). The lede is the default takeaway; a line the member picks replaces it.
//
// ═══ TWO THINGS THAT WILL BREAK THIS IF CHANGED CARELESSLY ═══
//
// 1. NO `keeper_type`. The routing rule is that a science read lands in "What you've learned" (things that
//    CONVINCED you) and NEVER in "What worked" (things you DID). Look at chapterKey() in lib/playbook/tabs.ts: it
//    switches on keeperType FIRST and only falls through to `section` if none matched. So setting keeperType to
//    'principle' — the intuitive choice for a science line — would route this to 'plays' → the "What worked" tab,
//    which is precisely the blur Rev 1 wrote the routing rule to prevent. The `why` chapter is reachable ONLY via
//    section 'why_works' with no keeper type. That is why this file passes `undefined` and says so.
//
// 2. IT VERIFIES ITS OWN WRITE. On 2026-07-27 prod dropped EVERY session keeper: `emitHarvestMoment` threw on a
//    schema drift, and because emit-then-commit sat inside ONE swallowed try, the throw took the keeper with it.
//    Millie completed six Sessions and harvested nothing, silently. The card tells the member "we'll keep the
//    takeaway in your Playbook" — a promise, in their words, on screen. So this reads the row back and returns a
//    boolean the caller can act on, and it LOGS on failure rather than swallowing. A write that reports success
//    without checking is how that outage looked from the inside.

import { randomUUID } from 'node:crypto';
import type { Db } from '../db/schema.ts';
import { commitKeeper } from '../agent/harvest.ts';
import { teachingKeeper } from './teaching.ts';
import type { SessionKey } from '../workspace/session-key.ts';

/** The Playbook section that reaches the `why` chapter → the "What you've learned" tab. See note 1 above. */
const WHY_SECTION = 'why_works';

export type KeptScience = { ok: boolean; body?: string; reason?: string };

/**
 * File the Session's science takeaway. Idempotent per Session: acknowledging twice must not file twice, because
 * the member can re-enter a closed Session and the card renders again.
 *
 * @param chosenLine the point head the member picked, if they used the optional "which line stayed with you?"
 */
export async function keepSessionScience(
  db: Db,
  memberId: string,
  sessionKey: SessionKey,
  sourceLabel: string,
  chosenLine?: string | null,
): Promise<KeptScience> {
  const keeper = teachingKeeper(sessionKey, sourceLabel, chosenLine);
  if (!keeper) return { ok: false, reason: 'nothing to keep for this session' };

  // Already filed? The member can re-open a closed Session and meet the card again.
  const existing = await db.query<{ id: string }>(
    `select id from playbook_entry
      where member_id = $1 and section = $2 and source_kind = 'science' and source_ref = $3 limit 1`,
    [memberId, WHY_SECTION, sessionKey],
  );
  if (existing.rows.length) return { ok: true, body: keeper.text, reason: 'already kept' };

  try {
    await commitKeeper(db, memberId, {
      momentId: randomUUID(),
      // NO keeperType — deliberate, see note 1. Setting one would route this to "What worked".
      section: WHY_SECTION,
      body: keeper.text,
      state: 'kept', // the member acknowledged it; it is not a proposal awaiting curation
      source: { kind: 'science', ref: sessionKey, label: sourceLabel },
    });
  } catch (e) {
    console.error(`[teaching] science keeper FAILED to commit for ${memberId}/${sessionKey}:`, e);
    return { ok: false, reason: 'commit threw' };
  }

  // READ IT BACK. The insert not throwing is not evidence the row is there — that is exactly how the 7/27 drop
  // looked from the application's side.
  const check = await db.query<{ id: string }>(
    `select id from playbook_entry
      where member_id = $1 and section = $2 and source_kind = 'science' and source_ref = $3 limit 1`,
    [memberId, WHY_SECTION, sessionKey],
  );
  if (!check.rows.length) {
    console.error(`[teaching] science keeper VANISHED after commit for ${memberId}/${sessionKey} — the member was told it was kept`);
    return { ok: false, reason: 'row absent after commit' };
  }
  return { ok: true, body: keeper.text };
}
