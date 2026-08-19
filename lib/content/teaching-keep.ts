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
  stage?: string | null,
): Promise<KeptScience> {
  const keeper = teachingKeeper(sessionKey, sourceLabel, chosenLine, stage);
  if (!keeper) return { ok: false, reason: 'nothing to keep for this session' };
  // THE REF IS PER CARD, NOT PER SESSION. Nine Sessions file one read each and `sessionKey` is enough. RECONNECT
  // files THREE — one as each of R1, R2 and R3 closes — and they are three different reads about three different
  // assets. Keyed on the session alone they would collide on the idempotency check above, and only the first
  // would ever be filed while the other two silently reported success.
  const ref = stage ? `${sessionKey}:${stage}` : sessionKey;

  // Already filed? The member can re-open a closed Session and meet the card again.
  const existing = await db.query<{ id: string }>(
    `select id from playbook_entry
      where member_id = $1 and section = $2 and source_kind = 'science' and source_ref = $3 limit 1`,
    [memberId, WHY_SECTION, ref],
  );
  if (existing.rows.length) return { ok: true, body: keeper.text, reason: 'already kept' };

  try {
    await commitKeeper(db, memberId, {
      momentId: randomUUID(),
      // NO keeperType — deliberate, see note 1. Setting one would route this to "What worked".
      section: WHY_SECTION,
      body: keeper.text,
      state: 'kept', // the member acknowledged it; it is not a proposal awaiting curation
      source: { kind: 'science', ref, label: sourceLabel },
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
    [memberId, WHY_SECTION, ref],
  );
  if (!check.rows.length) {
    console.error(`[teaching] science keeper VANISHED after commit for ${memberId}/${sessionKey} — the member was told it was kept`);
    return { ok: false, reason: 'row absent after commit' };
  }
  return { ok: true, body: keeper.text };
}

/**
 * Which of a session's science reads this member has ALREADY been shown and filed.
 *
 * WHY THIS EXISTS (Donna, 2026-08-19): "After the Legacy Letter appeared, two 'Why It Works' content blocks were
 * re-displayed that had already been shown to the member earlier in the program."
 *
 * Reconnect derives which cards are "taught" from the CURRENT STAGE alone, so it is a statement about how far she
 * has got — not about what she has seen. That is correct within one sitting, where the component watches each card
 * arrive. It breaks on RESUME: she comes back at a late stage, the component has no memory of the earlier ones, and
 * all three cards are treated as newly earned and land together at the end of the thread — after the Legacy Letter,
 * which is the most personal beat in the arc. Donna walked Reconnect across two sittings, which is why she hit it
 * and a single-sitting walk would not.
 *
 * The read was filed the moment she acknowledged it, so the answer already exists in her Playbook. Returns the
 * STAGES (the ref's suffix), which is what the chat keys its cards by.
 */
export async function keptScienceStages(db: Db, memberId: string, sessionKey: string): Promise<string[]> {
  try {
    const { rows } = await db.query<{ source_ref: string }>(
      `select source_ref from playbook_entry
        where member_id = $1 and section = $2 and source_kind = 'science' and source_ref like $3`,
      [memberId, WHY_SECTION, `${sessionKey}:%`],
    );
    return rows.map((r) => r.source_ref.slice(sessionKey.length + 1)).filter(Boolean);
  } catch (e) {
    // A read failure must never HIDE a card — showing one she has seen is a papercut; swallowing the error and
    // silently suppressing a card she has not seen would cost her the science entirely.
    console.error(`[teaching] could not read kept science for ${memberId}/${sessionKey}:`, e);
    return [];
  }
}
