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
import { tagBestEffort } from '../db/best-effort.ts';
import { memberToday } from '../time/zone-store.ts';

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

/** `source` records which route the day came in by — see migration 0076. Defaults to the conversation, which is
 *  where this function is called from; the grid has its own primitives below. */
export type W3EntryInput = Partial<Omit<W3Entry, 'entryDate'>> & { entryDate?: string; source?: string };

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
    entryDate: input.entryDate ?? (await memberToday(db, memberId)),
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
    await tagW3Source(db, memberId, e.entryDate, input.source ?? 'companion');
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
        where member_id = $1 and entry_date > ($3::date - ($2 || ' days')::interval)
        order by entry_date desc`,
      [memberId, String(days), await memberToday(db, memberId)],
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

// ── THE GRID'S WRITE PATH (2026-08-12) ────────────────────────────────────────────────────────────────────────
//
// W3's week was a read-only mirror: the Companion wrote the day from the check-in thread and the grid showed it.
// Jay tapped those boxes three times across two days and nothing happened. Going back to Greg's Engineering Memo,
// "the Companion writes it" is OURS — his ten UX requirements ask for "3. Quick check-in interface — LOW-FRICTION
// DAILY ENTRY" and for the Companion to support the habit "through anchoring, FRICTION REDUCTION, and streak
// reinforcement." A checkbox that does nothing is friction with nothing on the other side of it.
//
// A tick is a faithful entry, not a degraded one. The grid's rows already carry two of his seven fields — the
// "Noticed the day" row IS "an entry exists for this date", and a trigger row IS `trigger_fired` — and he is
// explicit that everything except the date is optional, because his bar is that a day completes in under a
// minute: "a required field is how that breaks."
//
// WHAT A TICK MAY NEVER DO IS DESTROY WRITING. Un-ticking a day the member wrote into would delete their own
// words behind a checkbox, so `clearW3Day` refuses and says why. Only an otherwise-empty day can be un-ticked.

/** The fields that carry the member's own words. `trigger_slot` is deliberately NOT one of them — it is a pick. */
export type W3DayContent = { hasWriting: boolean; triggerSlot: string | null; exists: boolean };

export async function readW3Day(db: Db, memberId: string, date: string): Promise<W3DayContent> {
  const { rows } = await db.query<{
    good_calls: string | null; false_starts: string | null; old_voice: string | null;
    recovery_used: boolean | null; reflection: string | null; trigger_slot: string | null;
  }>(
    `select good_calls, false_starts, old_voice, recovery_used, reflection, trigger_slot
       from w3_daily_entry where member_id=$1 and entry_date=$2::date`,
    [memberId, date],
  );
  const r = rows[0];
  if (!r) return { hasWriting: false, triggerSlot: null, exists: false };
  return {
    hasWriting:
      r.good_calls !== null || r.false_starts !== null || r.old_voice !== null ||
      r.recovery_used !== null || r.reflection !== null,
    triggerSlot: r.trigger_slot,
    exists: true,
  };
}

/** Mark the day as noticed — a bare entry, which is a real answer to "did you check in today". */
export async function ensureW3Day(db: Db, memberId: string, date: string, source: string): Promise<void> {
  await db.query(
    `insert into w3_daily_entry (member_id, entry_date) values ($1, $2::date)
     on conflict (member_id, entry_date) do update set updated_at = now()`,
    [memberId, date],
  );
  await tagW3Source(db, memberId, date, source);
}

/** The telemetry tag, always AFTER the member's row and never able to fail it. See lib/db/best-effort.ts. */
async function tagW3Source(db: Db, memberId: string, date: string, source: string): Promise<void> {
  await tagBestEffort(db, 'w3_daily_entry.source', `update w3_daily_entry set source=$3 where member_id=$1 and entry_date=$2::date`, [memberId, date, source]);
}

/**
 * Record which trigger fired — or clear it.
 *
 * ONE PER DAY, because that is Greg's field: `trigger_fired` is "which named trigger, or 'new'", singular. So
 * ticking a second trigger MOVES the mark rather than adding one, which is the member correcting which one it
 * was. That is visible on the grid the moment it re-renders — the first row's tick disappears — and a silent
 * second row would be the lie, not the move.
 */
export async function setW3Trigger(db: Db, memberId: string, date: string, slot: string | null, source: string): Promise<void> {
  await db.query(
    `insert into w3_daily_entry (member_id, entry_date, trigger_slot) values ($1, $2::date, $3)
     on conflict (member_id, entry_date) do update set trigger_slot = $3, updated_at = now()`,
    [memberId, date, slot],
  );
  await tagW3Source(db, memberId, date, source);
}

/** Un-tick a day. REFUSES when the member wrote anything into it — a checkbox must not delete prose. */
export async function clearW3Day(db: Db, memberId: string, date: string): Promise<{ ok: boolean; error?: string }> {
  const day = await readW3Day(db, memberId, date);
  if (!day.exists) return { ok: true };
  if (day.hasWriting) {
    return { ok: false, error: 'You wrote something into that day — open it with your companion to change it.' };
  }
  await db.query(`delete from w3_daily_entry where member_id=$1 and entry_date=$2::date`, [memberId, date]);
  return { ok: true };
}
