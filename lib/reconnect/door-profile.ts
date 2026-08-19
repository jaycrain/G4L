// The Door PROFILE — R2's missing half.
//
// WHAT WAS MISSING. We stored Doors as a bare SET: which of the eleven a member named, one flagged primary. Greg's
// R2 Science Check asks for two more things, and the re-audit counted them as three separate gaps:
//   1. RELEVANCE per Door — how much this one actually bears on their own Fade.
//   2. THE TEMPORAL PATTERN — which they walked through first, which weighs most today, which is STILL OPEN.
//   3. (the Community share — a separate surface, not this file)
//
// A CONTINUUM, NOT A CATEGORY. Greg's documents propose a 3-point scale; his 2026-08-08 email goes further than his
// own documents and asks for a continuum, "a profile of issues instead of a singular one". So relevance is 1–10.
// See migration 0085 for his verbatim words and the reasoning.
//
// THE HARD RULE THIS FILE ENFORCES: THE COMPANION PROPOSES, IT NEVER DECIDES. Every value here is something the
// member said about their own life. The model may not infer that a Door is "probably still open" from tone, or
// rate relevance because the member talked about one Door longer. `noteDoorProfile` writes only what it is handed
// and only for Doors the member already holds — it cannot create a Door as a side effect of rating one. That is
// the propose→confirm→commit posture (reclaim-c1-step2-data-contract) applied to the one record R3 reads from.
//
// ABSENT IS NOT ZERO. Every field is nullable and every existing member has none of them. A surface that renders a
// missing relevance as 0, or counts how many Doors have been rated, converts an invitation into a chore — and this
// is exactly the data where that would sting.

import type { Db } from '../db/schema.ts';
import { isDoorSlug, DOORS, type DoorSlug } from '../doors.ts';

export type DoorProfile = {
  slug: DoorSlug;
  displayName: string;
  isPrimary: boolean;
  /** 1–10, or null when never asked. Never render null as 0. */
  relevance: number | null;
  openedFirst: boolean | null;
  biggestImpact: boolean | null;
  /** The active Fade — the one R3's spark has to address. The single most useful field here. */
  stillOpen: boolean | null;
};

export type DoorProfileInput = {
  slug: string;
  relevance?: number | null;
  openedFirst?: boolean | null;
  biggestImpact?: boolean | null;
  stillOpen?: boolean | null;
};

/**
 * Clamp to the range the column accepts, or drop it entirely.
 *
 * A model that emits 0, 11, or 4.5 has misunderstood the scale, and coercing 0→1 would silently record a member as
 * having said "barely relevant" when they said nothing of the sort. Out-of-range becomes null — not asked — which
 * is the honest reading. Halves round to nearest so "about a 7 or 8" lands somewhere real.
 */
// GREG'S THREE-POINT SCALE, and its anchors. R2-04, verbatim: "1 = not relevant, 2 = somewhat relevant,
// 3 = very relevant", testable as "the rating control exposes exactly three options with those anchors, per door".
//
// It was briefly 1-10, from his 2026-08-08 email asking for a continuum — "a profile of issues instead of a
// singular one". Jay ruled back to three on 2026-08-18 once the built board made the cost visible: ten dots wrap
// to two rows PER MARKED CARD, so a member holding a few ends up facing thirty buttons on the surface whose job is
// recognition. Three points still deliver what the email actually asked for, which was a profile ACROSS Doors
// rather than one Door — that comes from marking several, not from the resolution of each.
//
// THE ANCHOR IS THE MEANING, not the number. Defined once here because it renders in two places that would
// otherwise disagree.
export const RELEVANCE_ANCHORS = ['not relevant', 'somewhat relevant', 'very relevant'] as const;

export function relevanceAnchor(n: number | null): string | null {
  return n && n >= 1 && n <= 3 ? RELEVANCE_ANCHORS[n - 1]! : null;
}

export function normalizeRelevance(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n >= 1 && n <= 3 ? n : null;
}

const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

/**
 * Record what the member said about one or more of their Doors.
 *
 * ONLY UPDATES — the `where` clause means a slug the member does not hold is a no-op, not an insert. Rating a Door
 * must never be how a Door gets added; that path is add_door, which reflects the wording back and is auditable.
 *
 * COALESCE per field, so a later turn ("that one's still open, actually") adds to what an earlier turn recorded
 * rather than blanking the rest. Same reasoning as recordB3Entry: a member gives this up a piece at a time.
 *
 * Returns the number of Doors actually touched, so a caller can tell "recorded" from "the model named a Door they
 * don't have" — which is a real failure worth seeing rather than a silent success.
 */
export async function noteDoorProfile(db: Db, memberId: string, entries: DoorProfileInput[]): Promise<number> {
  let touched = 0;
  for (const raw of entries) {
    if (!isDoorSlug(raw.slug)) continue;
    const relevance = normalizeRelevance(raw.relevance);
    const openedFirst = bool(raw.openedFirst);
    const biggestImpact = bool(raw.biggestImpact);
    const stillOpen = bool(raw.stillOpen);
    // Nothing said about this Door — writing would stamp noted_at and claim we asked.
    if (relevance === null && openedFirst === null && biggestImpact === null && stillOpen === null) continue;

    try {
      const { rows } = await db.query<{ door_slug: string }>(
        `update member_door set
           relevance      = coalesce($3, relevance),
           opened_first   = coalesce($4, opened_first),
           biggest_impact = coalesce($5, biggest_impact),
           still_open     = coalesce($6, still_open),
           noted_at       = now()
         where member_id = $1 and door_slug = $2 and removed_at is null
         returning door_slug`,
        [memberId, raw.slug, relevance, openedFirst, biggestImpact, stillOpen],
      );
      if (rows.length) touched++;
    } catch (err) {
      // LOUD. A swallowed write here loses something the member volunteered about their own life and the surface
      // renders it as never-asked — a confident lie (swallowed-read-renders-as-truth).
      console.error(`noteDoorProfile failed for member=${memberId} door=${raw.slug}:`, err);
    }
  }
  return touched;
}

/**
 * The member's Doors with whatever profile they've given, ordered as the member holds them.
 *
 * NOT ordered by relevance. Sorting the list by rating would turn a profile into a leaderboard of one's own
 * losses, and would silently demote every unrated Door to the bottom — the product ranking a member's life by how
 * much of it they happened to have talked about yet.
 */
export async function doorProfile(db: Db, memberId: string): Promise<DoorProfile[]> {
  try {
    const { rows } = await db.query<{
      door_slug: string; is_primary: boolean; relevance: number | null;
      opened_first: boolean | null; biggest_impact: boolean | null; still_open: boolean | null;
    }>(
      `select door_slug, is_primary, relevance, opened_first, biggest_impact, still_open
         from member_door
        where member_id = $1 and removed_at is null
        order by is_primary desc, sort_order`,
      [memberId],
    );
    return rows
      .filter((r) => isDoorSlug(r.door_slug))
      .map((r) => ({
        slug: r.door_slug as DoorSlug,
        displayName: DOORS.find((d) => d.slug === r.door_slug)?.displayName ?? r.door_slug,
        isPrimary: r.is_primary,
        // Postgres returns int as a number, PGlite can hand back a string — normalize so a caller comparing
        // `relevance >= 7` isn't quietly doing string comparison (jsonb-string-kills-sql-predicates, same shape).
        relevance: r.relevance === null ? null : Number(r.relevance),
        openedFirst: r.opened_first,
        biggestImpact: r.biggest_impact,
        stillOpen: r.still_open,
      }));
  } catch (err) {
    console.error(`doorProfile read failed for member=${memberId}:`, err);
    return [];
  }
}

/** The Doors the member says are STILL OPEN — the active Fade. What R3 and the Companion route on. */
export async function openDoors(db: Db, memberId: string): Promise<DoorProfile[]> {
  return (await doorProfile(db, memberId)).filter((d) => d.stillOpen === true);
}

/**
 * A one-line description of the profile for the Companion's context — or null when there's nothing to say.
 *
 * NULL WHEN EMPTY IS LOAD-BEARING. A member who has never been asked must produce no line at all, so the model is
 * never handed "no doors are still open" and cannot reflect an absence of data back as a fact about their life.
 * That is the exact failure in context-must-not-claim-what-it-stopped-tracking.
 */
export function describeDoorProfile(doors: DoorProfile[]): string | null {
  const parts: string[] = [];
  const first = doors.find((d) => d.openedFirst);
  const biggest = doors.find((d) => d.biggestImpact);
  const open = doors.filter((d) => d.stillOpen === true);
  const rated = doors.filter((d) => d.relevance !== null);

  if (first) parts.push(`opened first: ${first.displayName}`);
  if (biggest) parts.push(`weighs most today: ${biggest.displayName}`);
  if (open.length) parts.push(`still open: ${open.map((d) => d.displayName).join(', ')}`);
  if (rated.length) parts.push(`rated ${rated.map((d) => `${d.displayName} ${relevanceAnchor(d.relevance)}`).join(', ')}`);

  return parts.length ? parts.join(' · ') : null;
}

/**
 * Her Doors for the PLAYBOOK, under "Who you are". One line per Door, in the order she holds them.
 *
 * WHY THIS BELONGS IN "WHO YOU ARE" AT ALL. That tab holds ONLY member-authored identity — every instrument READ
 * lives under "What you've learned", because a probabilistic reading sitting under a tab that claims to say who
 * someone is turns it into a verdict about the self (lib/playbook/tabs.ts). Matcher-inferred Doors would break
 * that rule. Doors she marked, rated and ordered HERSELF on the R2 board do not: self-claim converts an inference
 * about her into a statement by her. The board is what makes them eligible.
 *
 * NO NUMBERS, EVER. She sees the anchor she chose, never "2/3" — a score about how much your own life happened to
 * you is not a thing to hand back. And an unrated Door renders as the Door alone, never as a zero or a gap.
 */
export function playbookDoorLines(doors: DoorProfile[]): { name: string; note: string | null }[] {
  return doors.map((d) => {
    const bits: string[] = [];
    if (d.openedFirst) bits.push('opened first');
    if (d.biggestImpact) bits.push('weighs most today');
    if (d.stillOpen === true) bits.push('still open');
    const anchor = relevanceAnchor(d.relevance);
    if (anchor && anchor !== 'not relevant') bits.push(anchor);
    return { name: d.displayName, note: bits.length ? bits.join(' · ') : null };
  });
}
