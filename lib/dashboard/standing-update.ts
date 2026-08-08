// "WHERE YOU STAND" — the Companion's standing update, shown every visit above the thread.
//
// Jay (2026-08-08): "Companion: gives an update on where the member stands, similar to how the FC works.
// Creates more engagement potentially too." … "it is central to how everything else is going to work."
//
// THE GAP IT FILLS. openCheckin only writes an opening message when the thread is EMPTY — so a returning member
// gets their old conversation and nothing else. The Companion had no way to say "here's where you are" on a day
// when nothing was due, which is most days. That is also the day a member is most likely to drift.
//
// IT IS COMPUTED, NOT ASKED FOR. Straight from the Founder Console's companion, whose comment says it best:
// "the read is already done when he arrives." A model call per dashboard load would be slow, expensive, and —
// the real objection — able to invent. A standing update's whole value is that it is TRUE, so it is assembled
// from facts and rendered by code. The model's job stays the conversation itself.
//
// TWO LESSONS INHERITED FROM THE FC, both learned the hard way there:
//   1. LEAD WITH THE DELTA, not a snapshot. A line that reads the same on three consecutive visits teaches the
//      member to stop reading it.
//   2. NAME THE BASELINE. The FC once told Jay "10 things moved since you last looked" three days running, and
//      because the sentence never said WHEN "last looked" was, a stuck marker read as fresh news. A delta that
//      dates itself shows a stuck baseline for free.
//
// GOVERNANCE. This is a reflection, never a verdict and never a scold. "Nothing needs you today" is the honest
// version of a quiet week; the tempting version ("you haven't logged since Tuesday") is a report card, and a
// surface that grades people is one they stop opening — which costs us the member and the data.

import type { Db } from '../db/schema.ts';
import type { HeroCard } from './hero-card.ts';
import { lastAccomplishment } from './last-accomplishment.ts';
import { weekGrid } from '../practice/grid.ts';

export type StandingFacts = {
  /** "Reclaim" — the phase they're in. */
  phase: string;
  /** Sessions done / total in this phase, when the phase has more than one. */
  position: { done: number; of: number } | null;
  /** True when the next thing is the phase Checkpoint. */
  checkpointReady: boolean;
  /** The last thing they finished, already a full sentence (from lastAccomplishment). */
  finished: string | null;
  /** An OPEN practice week: which day of seven, and how many rows they've marked today. */
  openWeek: { day: number; of: number; markedToday: number; rows: number } | null;
  /** Days since their previous visit — the delta's baseline. Null on a first visit. */
  daysSinceLastVisit: number | null;
};

/** Days between two instants, floored. Exported for the test that pins the boundary wording. */
export function daysBetween(then: Date, now: Date): number {
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}

function sinceWhen(days: number): string {
  if (days <= 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  return `${Math.floor(days / 7)} weeks ago`;
}

/** THE PURE PART — facts in, the member-facing paragraph out. Kept separate from the reads so the WORDING can be
 *  tested exhaustively without a database, which is what matters: every branch here is a sentence a real member
 *  reads on a real day, including the ones where they have done nothing at all. */
export function buildStandingLine(f: StandingFacts): string {
  const bits: string[] = [];

  // 1. WHERE THEY ARE. Position first, because it is the question the panel exists to answer.
  const where =
    f.position && f.position.of > 1
      ? `You're in ${f.phase}, ${f.position.done} of ${f.position.of} sessions done.`
      : `You're in ${f.phase}.`;
  bits.push(f.checkpointReady ? `${where.replace(/\.$/, '')} — the Checkpoint is the last one.` : where);

  // 2. WHAT THEY LAST FINISHED. Their own work, named. Already a full sentence, and already carries its own
  //    day anchor ("yesterday", "on Friday") — which is the self-dating lesson, met by reusing that function
  //    rather than re-implementing the date logic here and letting the two drift.
  if (f.finished) bits.push(f.finished);

  // 3. WHAT IS LIVE, and whether anything actually needs them. The order matters: a running week is a fact about
  //    today, so it comes after the retrospective and before the invitation.
  if (f.openWeek) {
    const { day, of, markedToday, rows } = f.openWeek;
    bits.push(
      markedToday > 0
        ? `Your practice week is on day ${day} of ${of}, and today's already marked.`
        : `Your practice week is on day ${day} of ${of}${rows > 0 ? " — today isn't marked yet." : '.'}`,
    );
  }

  // 4. THE CLOSE. Never a chase. If nothing is genuinely outstanding, say so plainly — that is the sentence that
  //    makes the whole update trustworthy, because a surface that only ever finds work for you is one you learn
  //    to dread. The delta names its own baseline (lesson 2) so a stuck marker is visible rather than disguised.
  const seen = f.daysSinceLastVisit;
  if (seen !== null && seen >= 3) bits.push(`Good to see you — it's been ${sinceWhen(seen)}.`);
  const needsThem = f.checkpointReady || (f.openWeek !== null && f.openWeek.markedToday === 0 && f.openWeek.rows > 0);
  if (!needsThem) bits.push('Nothing needs you today.');

  return bits.join(' ');
}

/** Assemble the facts and render them. Null when there is nothing honest to say yet (a member mid-onboarding),
 *  in which case the surface simply doesn't render — better than a hollow "you're getting started!". */
export async function standingUpdate(
  db: Db,
  memberId: string,
  hero: HeroCard | null,
  now = new Date(),
): Promise<string | null> {
  if (!hero) return null;
  try {
    const [finishedRes, grid, lastVisit] = await Promise.all([
      lastAccomplishment(db, memberId, now),
      weekGrid(db, memberId).catch(() => null),
      previousVisit(db, memberId),
    ]);

    // ringSub carries "2 of 3" for a multi-session phase; parse rather than recompute so the update and the ring
    // can never disagree about the same number in the same eyeline.
    const m = /^(\d+) of (\d+)$/.exec(hero.ringSub ?? '');
    const facts: StandingFacts = {
      phase: hero.ringTop,
      position: m ? { done: Number(m[1]), of: Number(m[2]) } : null,
      checkpointReady: hero.ringSub === 'checkpoint',
      finished: finishedRes?.text ?? null,
      openWeek:
        grid && !grid.closed && grid.rows.length > 0
          ? {
              day: grid.day,
              of: 7,
              // GridRow has no "marked today" flag — it carries marks[] over the 7-day window, and `day` is
              // 1-based. Reading marks[day - 1] is the whole translation; inventing a markedToday field would
              // have been a second source of truth for something the grid already knows.
              markedToday: grid.rows.filter((r) => r.marks[grid.day - 1] === true).length,
              rows: grid.rows.length,
            }
          : null,
      daysSinceLastVisit: lastVisit ? daysBetween(lastVisit, now) : null,
    };
    return buildStandingLine(facts);
  } catch (e) {
    // LOUD, then no panel. A standing update that silently degrades to nothing is acceptable for the member;
    // silently degrading for US is how a broken read ships as a feature.
    console.error(`standingUpdate failed for member=${memberId}:`, e);
    return null;
  }
}

/** The visit BEFORE this one — the delta's baseline. The current page load has already logged its own page_view
 *  by the time this runs, so the second row is the real "last time you were here". */
async function previousVisit(db: Db, memberId: string): Promise<Date | null> {
  try {
    const { rows } = await db.query<{ at: string }>(
      `select created_at::text as at from member_event
        where member_id = $1 and kind = 'page_view' and surface = 'dashboard'
        order by created_at desc
        limit 1 offset 1`,
      [memberId],
    );
    return rows[0]?.at ? new Date(rows[0].at) : null;
  } catch {
    // No baseline is a fine answer — the line simply omits the "good to see you" clause rather than guessing one.
    return null;
  }
}
