// W3's daily entry — the seven fields of Greg's monitoring tracker, one row per day.
//
// The spec is his Engineering Memo (W3-30), verbatim: "date (auto) / smart_choices (free-text or quick-tag —
// what the Member noticed) / false_starts (free-text or quick-tag — what the Member noticed) / trigger_fired
// (which named trigger, or 'new') / disinformation_campaign (what the old voice said, optional) / recovery_used
// (whether the Member used the prepared response, optional) / member_reflection (optional)".
//
// THE POSTURE IS THE DESIGN HERE, so it is worth stating before the code:
//
//   · GOOD CALLS AND FALSE STARTS ARE THE SAME KIND OF THING. Greg: "Both Smart Choices and False Starts are
//     logged the same way — as data, not verdicts." Same type, same nullability, no ordering that implies one is
//     the bad one, and no scoring anywhere. A count of false starts is not computed, because the moment it exists
//     something will render it.
//   · EVERYTHING EXCEPT THE DATE IS OPTIONAL. A minimal entry — one good call, or one false start, or neither —
//     is valid. Greg's requirement is that it completes in under a minute; a required field is how that breaks.
//   · recovery_used IS TRI-STATE. null means "didn't say", which is genuinely different from false ("didn't use
//     it"). Defaulting it to false would silently record a failure the member never reported.
//   · NO TARGET, NO COUNT, NO STREAK. W3 has no adherence measure anywhere in the asset.

import type { Db } from '../db/schema.ts';

export type W3Entry = {
  entryDate: string; // YYYY-MM-DD
  goodCalls: string | null;
  falseStarts: string | null;
  /** practice_commitment.slot for one of their named triggers, or 'new', or null for "didn't say". */
  triggerSlot: string | null;
  oldVoice: string | null;
  recoveryUsed: boolean | null;
  reflection: string | null;
};

export type W3EntryInput = Partial<Omit<W3Entry, 'entryDate'>> & { entryDate?: string };

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? '').trim();
  return t.length ? t : null;
};

/** Record (or amend) one day. Upserts on (member, date) — a member editing today's entry updates it rather than
 *  creating a second row, so the grid can never show a day as both marked and unmarked.
 *
 *  Returns false when there is nothing to record. An entry with every field empty is not a day they logged; it
 *  is a form they opened, and writing it would mark the day on the grid without the member having said anything. */
export async function recordW3Entry(db: Db, memberId: string, input: W3EntryInput): Promise<boolean> {
  const e: W3Entry = {
    entryDate: input.entryDate ?? new Date().toISOString().slice(0, 10),
    goodCalls: clean(input.goodCalls),
    falseStarts: clean(input.falseStarts),
    triggerSlot: clean(input.triggerSlot),
    oldVoice: clean(input.oldVoice),
    recoveryUsed: input.recoveryUsed ?? null,
    reflection: clean(input.reflection),
  };
  const saidSomething =
    e.goodCalls !== null || e.falseStarts !== null || e.triggerSlot !== null ||
    e.oldVoice !== null || e.recoveryUsed !== null || e.reflection !== null;
  if (!saidSomething) return false;

  try {
    await db.query(
      `insert into w3_daily_entry
         (member_id, entry_date, good_calls, false_starts, trigger_slot, old_voice, recovery_used, reflection)
       values ($1, $2::date, $3, $4, $5, $6, $7, $8)
       on conflict (member_id, entry_date) do update set
         -- COALESCE so an amendment ADDS without erasing. A member who logs a good call in the morning and a
         -- false start at night must end the day with both; a naive overwrite would silently drop the morning.
         good_calls    = coalesce(excluded.good_calls, w3_daily_entry.good_calls),
         false_starts  = coalesce(excluded.false_starts, w3_daily_entry.false_starts),
         trigger_slot  = coalesce(excluded.trigger_slot, w3_daily_entry.trigger_slot),
         old_voice     = coalesce(excluded.old_voice, w3_daily_entry.old_voice),
         recovery_used = coalesce(excluded.recovery_used, w3_daily_entry.recovery_used),
         reflection    = coalesce(excluded.reflection, w3_daily_entry.reflection),
         updated_at    = now()`,
      [memberId, e.entryDate, e.goodCalls, e.falseStarts, e.triggerSlot, e.oldVoice, e.recoveryUsed, e.reflection],
    );
    return true;
  } catch (err) {
    // LOUD. A swallowed write here loses the member's day and renders as "you didn't log" — a confident lie about
    // someone who sat down and wrote something.
    console.error(`recordW3Entry failed for member=${memberId} date=${e.entryDate}:`, err);
    return false;
  }
}

/** The entries inside the current monitoring window, newest first. Drift-hardened: a read hiccup degrades to no
 *  entries (the grid renders empty) rather than taking the surface down. */
export async function w3Entries(db: Db, memberId: string, days = 7): Promise<W3Entry[]> {
  try {
    const { rows } = await db.query<{
      entry_date: string; good_calls: string | null; false_starts: string | null;
      trigger_slot: string | null; old_voice: string | null; recovery_used: boolean | null; reflection: string | null;
    }>(
      `select entry_date::text as entry_date, good_calls, false_starts, trigger_slot, old_voice, recovery_used, reflection
         from w3_daily_entry
        where member_id = $1 and entry_date > current_date - ($2 || ' days')::interval
        order by entry_date desc`,
      [memberId, String(days)],
    );
    return rows.map((r) => ({
      entryDate: r.entry_date,
      goodCalls: r.good_calls,
      falseStarts: r.false_starts,
      triggerSlot: r.trigger_slot,
      oldVoice: r.old_voice,
      recoveryUsed: r.recovery_used,
      reflection: r.reflection,
    }));
  } catch (e) {
    console.error(`w3Entries read failed for member=${memberId}:`, e);
    return [];
  }
}
