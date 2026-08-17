// B3's monitoring week — Greg's seven fields per day.
//
// WHY THIS EXISTS. The re-audit found B3 recording its week as a BOOLEAN TICK (practice_mark: commitment + date).
// Greg's in-app summary says the member tracks "Smart Choices, False Starts, obstacles, THOUGHTS, FEELINGS, and
// how eating and movement influence one another" — six of those seven had nowhere to go. W3 got this treatment on
// 2026-08-08 (migration 0074); B3 was simply behind on the same requirement, so this MIRRORS w3-entry.ts rather
// than inventing a second shape for the same job.
//
// THE TICK STAYS. practice_mark still records that a commitment was kept — that is what draws Greg's grid. This
// holds the OBSERVATION beside it. They answer different questions ("did the plan happen" / "what did you
// notice"), and merging them would force anyone who wants to write a sentence to also assert a tick.
//
// NO COUNT, NO SCORE, ANYWHERE. B3's Engineering Memo lists "presents a compliance score, fitness score, or
// percentage" as off-target, and "affirms Smart Choices more than tracking consistency" right beside it. Nothing
// here totals anything, and nothing should be added that does.

import type { Db } from '../db/schema.ts';
import { memberToday } from '../time/zone-store.ts';

export type B3Entry = {
  entryDate: string;
  /** Greg: smart_choices. */
  goodCalls: string | null;
  /** Greg: false_starts. Same weight as goodCalls — data, not a verdict. */
  falseStarts: string | null;
  /** Greg: what_contributed — what made the Smart Choice easy or the False Start hard. */
  contributed: string | null;
  /** Greg: obstacles. */
  obstacles: string | null;
  /** Greg: thoughts_feelings. */
  thoughts: string | null;
  /** Greg: fuel_to_move. INVITED, NEVER FORCED — "You don't have to find a connection every day." */
  fuelToMove: string | null;
  /** Greg: member_reflection. */
  reflection: string | null;
};

export type B3EntryInput = Partial<Omit<B3Entry, 'entryDate'>> & { entryDate?: string };

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? '').trim();
  return t.length ? t : null;
};

const FIELDS = ['goodCalls', 'falseStarts', 'contributed', 'obstacles', 'thoughts', 'fuelToMove', 'reflection'] as const;

/**
 * Record (or amend) one day. Upserts on (member, date), so editing today updates rather than adding a second row.
 *
 * Returns false when nothing was said. An entry with every field empty is not a day they logged — it is a form
 * they opened, and writing it would mark the day as recorded without the member having said anything.
 */
export async function recordB3Entry(db: Db, memberId: string, input: B3EntryInput): Promise<boolean> {
  const entryDate = input.entryDate ?? (await memberToday(db, memberId));
  const e = Object.fromEntries(FIELDS.map((k) => [k, clean(input[k])])) as Omit<B3Entry, 'entryDate'>;
  if (!FIELDS.some((k) => e[k] !== null)) return false;

  try {
    await db.query(
      `insert into b3_daily_entry
         (member_id, entry_date, good_calls, false_starts, contributed, obstacles, thoughts, fuel_to_move, reflection)
       values ($1, $2::date, $3, $4, $5, $6, $7, $8, $9)
       on conflict (member_id, entry_date) do update set
         -- COALESCE so an amendment ADDS without erasing. Someone who logs a Smart Choice at lunch and a False
         -- Start at night must end the day holding both; a naive overwrite silently drops the earlier one.
         good_calls   = coalesce(excluded.good_calls, b3_daily_entry.good_calls),
         false_starts = coalesce(excluded.false_starts, b3_daily_entry.false_starts),
         contributed  = coalesce(excluded.contributed, b3_daily_entry.contributed),
         obstacles    = coalesce(excluded.obstacles, b3_daily_entry.obstacles),
         thoughts     = coalesce(excluded.thoughts, b3_daily_entry.thoughts),
         fuel_to_move = coalesce(excluded.fuel_to_move, b3_daily_entry.fuel_to_move),
         reflection   = coalesce(excluded.reflection, b3_daily_entry.reflection),
         updated_at   = now()`,
      [memberId, entryDate, e.goodCalls, e.falseStarts, e.contributed, e.obstacles, e.thoughts, e.fuelToMove, e.reflection],
    );
    return true;
  } catch (err) {
    // LOUD. A swallowed write loses the member's day and renders as "you didn't log" — a confident lie about
    // someone who sat down and wrote something. Same rule as w3-entry.ts.
    console.error(`recordB3Entry failed for member=${memberId} date=${entryDate}:`, err);
    return false;
  }
}

/** The entries inside the current window, newest first. A read hiccup degrades to none rather than taking the
 *  surface down — the week renders empty instead of erroring. */
export async function b3Entries(db: Db, memberId: string, days = 7): Promise<B3Entry[]> {
  try {
    const { rows } = await db.query<{
      entry_date: string; good_calls: string | null; false_starts: string | null; contributed: string | null;
      obstacles: string | null; thoughts: string | null; fuel_to_move: string | null; reflection: string | null;
    }>(
      `select entry_date::text as entry_date, good_calls, false_starts, contributed, obstacles, thoughts,
              fuel_to_move, reflection
         from b3_daily_entry
        -- THE MEMBER'S today, not the server's. current_date here would window the week in UTC, which puts a
        -- Boulder evening on tomorrow and drops the day they just wrote. lib/time is the one authority for this
        -- (see member-local-time); w3-entry.ts does the same and this must not diverge from it.
        where member_id = $1 and entry_date > ($3::date - ($2 || ' days')::interval)
        order by entry_date desc`,
      [memberId, String(days), await memberToday(db, memberId)],
    );
    return rows.map((r) => ({
      entryDate: r.entry_date,
      goodCalls: r.good_calls,
      falseStarts: r.false_starts,
      contributed: r.contributed,
      obstacles: r.obstacles,
      thoughts: r.thoughts,
      fuelToMove: r.fuel_to_move,
      reflection: r.reflection,
    }));
  } catch (err) {
    console.error(`b3Entries read failed for member=${memberId}:`, err);
    return [];
  }
}
