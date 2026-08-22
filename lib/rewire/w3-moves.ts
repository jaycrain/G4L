// W3's THREE PROTOCOL MOVES, AS ROWS — Redirect, Reframe, Restart, in the member's own words.
//
// WHY THIS EXISTS. The monitoring week's rows were "Noticed the day" plus one row per TRIGGER. Donna, 2026-08-21:
// neither the copy nor the tracked categories "give the member a clear, logical next step — it's unclear what
// she's supposed to actually be doing day to day." She is right, and the reason is that trigger rows record what
// went WRONG. The file that built them says so itself: rows must not become "a record of things going wrong,
// which inverts the whole posture."
//
// GREG'S OWN STRUCTURE, RESTORED. His REWIRE Gated Assets V4, Step 2 "Build Your Response", names three elements
// and the member writes each one herself:
//   Redirect — "Develop redirect strategies to address triggers." (five minutes · walk round the block · call someone)
//   Reframe  — "Write these sentences in your own words and keep them somewhere you'll see them."
//   Restart  — "Visualize how you will respond WHEN you have a false start… go back to the image from the
//              Visualization Workshop."
// So tracking "I redirected / I reframed / I restarted" is not an extension of his spec — it is his Step 2, one
// row per element. And `recovery_used` ("whether the Member used the prepared response") is already one of the
// seven fields in W3-33; it was captured and never surfaced anywhere.
//
// HIS CAPITALISATION IS NOT OURS. The asset camel-cases all three, the same house style it uses for the four Rs.
// One capital each here — and tests/naming-guard.test.ts now fails on his spelling, which is how this very comment
// got rewritten: the first draft spelled his version out to explain the rule and tripped the rule doing it.
//
// NO MIGRATION, for the same three reasons as the triggers: `practice_commitment` already holds "the rows of this
// member's week", `weekGrid` already renders commitments, and `target_days = null` IS Greg's requirement — no
// adherence target and no perfect week anywhere in W3.
//
// THE LABELS ARE HERS, VERBATIM. "The Member must author the protocol… The system cannot supply a trigger list or
// a recovery script." So nothing here proposes or tidies. Where a move has no member words — Restart, whose card
// text was hard-coded generic for everyone — the row falls back to her W2 IMAGE, which is still her words, and
// only to a bare verb if even that is missing.

import type { Db } from '../db/schema.ts';

/** The three moves, in Greg's Step 2 order. Slots are stable so re-running W3 updates rather than accumulates. */
export const W3_MOVES = [
  { slot: 'move-redirect', verb: 'I redirected' },
  { slot: 'move-reframe', verb: 'I reframed' },
  { slot: 'move-restart', verb: 'I restarted' },
] as const;

export type W3MoveSlot = (typeof W3_MOVES)[number]['slot'];

/** What the member wrote for each move. Any field may be absent — she is never forced to author all three. */
export type W3MoveWords = { redirect?: string | null; reframe?: string | null; restart?: string | null };

/**
 * The row label for one move: her verb plus her words.
 *
 * Truncation is a DISPLAY concern and happens in the UI, never here — a stored label that has been shortened is a
 * rewrite of what she said, and the whole point of this file is that it isn't.
 */
export function moveLabel(slot: W3MoveSlot, words: W3MoveWords): string {
  const verb = W3_MOVES.find((m) => m.slot === slot)!.verb;
  const own = slot === 'move-redirect' ? words.redirect
    : slot === 'move-reframe' ? words.reframe
      : words.restart;
  const text = (own ?? '').trim();
  return text ? `${verb} — ${text}` : verb;
}

/**
 * Persist the three moves as the rows of the monitoring week. Idempotent.
 *
 * Best-effort, like saveW3Triggers: called at W3 completion where a throw must never cost the member their
 * finished session. It logs, because a silent failure renders as "this member built no protocol" — a confident
 * lie about someone who just spent a session building one.
 *
 * A move with no words still gets its row. That is deliberate: the three are a set, and dropping the one she
 * left blank would quietly tell her that part of the protocol does not count.
 */
export async function saveW3Moves(db: Db, memberId: string, words: W3MoveWords): Promise<number> {
  let saved = 0;
  for (const [i, m] of W3_MOVES.entries()) {
    try {
      await db.query(
        `insert into practice_commitment (member_id, kind, slot, label, target_days, sort_order)
         values ($1, 'w3_logging', $2, $3, null, $4)
         on conflict (member_id, kind, slot) do update set label = excluded.label, updated_at = now()`,
        // sort_order 1..3 — row 0 is "Checked in", and the trigger rows (10+) sit below if ever shown again.
        [memberId, m.slot, moveLabel(m.slot, words), i + 1],
      );
      saved++;
    } catch (e) {
      console.error(`saveW3Moves: ${m.slot} failed for member=${memberId}:`, e);
    }
  }
  return saved;
}

/** The member's three move rows, in Greg's order. Empty when W3's protocol was never built. */
export async function w3Moves(db: Db, memberId: string): Promise<{ slot: string; label: string }[]> {
  try {
    const { rows } = await db.query<{ slot: string; label: string }>(
      `select slot, label from practice_commitment
        where member_id = $1 and kind = 'w3_logging' and slot like 'move-%'
        order by sort_order`,
      [memberId],
    );
    return rows;
  } catch (e) {
    // Never swallow to []: an empty read renders as "she built no protocol", which is the same confident lie.
    console.error(`w3Moves: read failed for member=${memberId}:`, e);
    return [];
  }
}
