// W3's triggers, as ROWS — the first slice of the monitoring week.
//
// WHY THIS EXISTS. Greg's W3 tracker has a `trigger_fired` field defined as "which named trigger, or 'new'".
// That needs a LIST to choose from. Today W3's triggers survive only as prose inside a single `recovery_move`
// Playbook keeper ("Triggers: x; y; z / Redirect — … / Reframe — …"), which is right for recall and useless for
// a picker. So the week could not ask which trigger fired until the triggers existed as rows. Invisible from the
// outside, and the thing that would otherwise have surfaced halfway through the UI work.
//
// NO MIGRATION, ON PURPOSE. These land in `practice_commitment` — the table the practice week already uses for
// "the rows of this member's week" — with `target_days = null`. Three things fall out for free:
//   1. `weekGrid` already renders commitments, so the W3 grid gets its rows without a second mechanism.
//   2. `target_days = null` IS Greg's requirement: no adherence target, no completion %, no "perfect week"
//      anywhere in W3 (the same reason C3's rows carry no target).
//   3. Migrations here go to Jay to paste by hand — not spending one when an existing table fits is real value.
//
// THE LABELS ARE THE MEMBER'S OWN WORDS, VERBATIM. Greg is explicit: "The Member must author the protocol. The
// triggers, the responses, the tracking rhythm, and the focus of monitoring are all the Member's to choose. The
// system cannot supply a trigger list or a recovery script." So nothing here proposes, tidies, or re-words a
// trigger. They arrive as the member typed them during the draw-out, and if that reads long in a grid cell, the
// UI truncates for DISPLAY — a rendering concern, never a rewrite of what they said.

import type { Db } from '../db/schema.ts';

/** Stable per-trigger slot key. `practice_commitment` is unique on (member_id, kind, slot), so re-running W3
 *  updates the same rows rather than accumulating duplicates. */
const slotFor = (i: number) => `trigger-${i + 1}`;

export type W3Trigger = { slot: string; label: string };

/** Persist the member's drawn-out triggers as the rows of their monitoring week. Idempotent.
 *
 *  Best-effort by design: called at W3 completion alongside startPracticeWeek, where a throw must never cost the
 *  member their finished session. It DOES log, though — a silent failure here renders as "this member named no
 *  triggers", which is a confident lie about someone who named three. */
export async function saveW3Triggers(db: Db, memberId: string, triggers: string[]): Promise<number> {
  const clean = triggers.map((t) => (t ?? '').trim()).filter((t) => t.length >= 3);
  if (!clean.length) return 0;
  let saved = 0;
  for (const [i, label] of clean.entries()) {
    try {
      await db.query(
        `insert into practice_commitment (member_id, kind, slot, label, target_days, sort_order)
         values ($1, 'w3_logging', $2, $3, null, $4)
         on conflict (member_id, kind, slot) do update set label = excluded.label, updated_at = now()`,
        [memberId, slotFor(i), label, i],
      );
      saved++;
    } catch (e) {
      console.error(`saveW3Triggers: row ${i} failed for member=${memberId}:`, e);
    }
  }
  return saved;
}

/** The member's named triggers, in the order they named them. The picker's source, and the grid's rows. */
export async function w3Triggers(db: Db, memberId: string): Promise<W3Trigger[]> {
  try {
    const { rows } = await db.query<{ slot: string; label: string }>(
      `select slot, label from practice_commitment
        where member_id = $1 and kind = 'w3_logging'
        order by sort_order, slot`,
      [memberId],
    );
    return rows.map((r) => ({ slot: r.slot, label: r.label }));
  } catch (e) {
    console.error(`w3Triggers read failed for member=${memberId}:`, e);
    return [];
  }
}
