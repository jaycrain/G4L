// THE BOARD'S WRITE PATH — what happens when a MEMBER taps a card.
//
// D5, rulings #4 and #8 (docs/decisions/2026-08-18-doors-board-D5.md).
//
// WHY THIS IS A SEPARATE MODULE FROM noteDoorProfile, AND NOT AN `actor` FLAG.
//
// noteDoorProfile is UPDATE-ONLY on purpose: "rating a Door must never be how a Door gets added." That guard was
// written to stop the MODEL inventing Doors from tone — it rates whatever it heard, and an insert would let a
// misread turn into a fact about someone's life. It is correct and it stays exactly as it is.
//
// A member tapping a card is a different actor making a different kind of statement, and ruling #4 says her claim
// outranks our matcher. So she CAN create a Door here.
//
// The distinction could have been a parameter — `noteDoorProfile(db, id, entries, { actor: 'member' })` — and that
// would have been a mistake. A flag is something a future call site can pass wrongly, in a codebase where the
// model's tool handlers and the board's action live in different files and get edited months apart. Two functions
// with two contracts cannot be confused: the model's path has no insert to reach for.

import type { Db } from '../db/schema.ts';
import { isDoorSlug, DOORS, type DoorSlug } from '../doors.ts';
import { normalizeRelevance } from './door-profile.ts';

export type BoardClaim = {
  slug: DoorSlug;
  /** 1–10, or null when she marked the card without rating it. Marking and rating are separate acts (ruling #7). */
  relevance?: number | null;
};

/**
 * She marked a Door on the board. Creates it if she does not hold it, then records the rating.
 *
 * Returns the slugs actually written. A caller that gets back fewer than it sent has a real failure worth
 * surfacing rather than a silent success.
 */
export async function claimDoorsFromBoard(db: Db, memberId: string, claims: BoardClaim[]): Promise<DoorSlug[]> {
  const written: DoorSlug[] = [];
  for (const claim of claims) {
    if (!isDoorSlug(claim.slug)) continue;
    const relevance = normalizeRelevance(claim.relevance);
    try {
      // Ordered LAST so a Door she adds here sits after the ones her story produced, rather than jumping the
      // list. Her intake Doors came first in time and the board is an addition to that story, not a replacement.
      const { rows } = await db.query<{ n: number }>(
        `select coalesce(max(sort_order), -1) + 1 as n from member_door where member_id = $1 and removed_at is null`,
        [memberId],
      );
      const next = rows[0]?.n ?? 0;
      await db.query(
        `insert into member_door (member_id, door_slug, is_primary, sort_order, relevance, noted_at)
         values ($1, $2, false, $3, $4, now())
         on conflict (member_id, door_slug) do update set
           relevance  = coalesce($4, member_door.relevance),
           removed_at = null,
           noted_at   = now()`,
        [memberId, claim.slug, next, relevance],
      );
      written.push(claim.slug);
    } catch (err) {
      // LOUD — a swallowed write loses something she said about her own life and the board renders it as never
      // asked, which is a confident lie (swallowed-read-renders-as-truth).
      console.error(`claimDoorsFromBoard failed for member=${memberId} door=${claim.slug}:`, err);
    }
  }
  return written;
}

/**
 * She named which Door weighs most today — RULING #8: this updates `is_primary`.
 *
 * She has just read every Door and made a deliberate judgement; `is_primary` was our inference from her story,
 * often weeks earlier. Keeping both would leave two answers to "which is her Door", and the dashboard, the
 * Companion and the founder emails all read primary — so they would disagree with the thing she just told us.
 *
 * Exactly one primary, always. The clear-then-set is why this is one function and not two calls: a caller that
 * did them separately could leave her with none, or with two.
 */
export async function setBiggestImpact(db: Db, memberId: string, slug: DoorSlug): Promise<boolean> {
  if (!isDoorSlug(slug)) return false;
  const { rows } = await db.query<{ door_slug: string }>(
    `select door_slug from member_door where member_id = $1 and door_slug = $2 and removed_at is null`,
    [memberId, slug],
  );
  // She can only weigh a Door she holds. The board claims it first (claimDoorsFromBoard), so this is a real
  // failure — not a case to paper over by inserting one here.
  if (!rows.length) return false;

  await db.query(`update member_door set biggest_impact = false where member_id = $1 and biggest_impact = true`, [memberId]);
  await db.query(`update member_door set is_primary = false where member_id = $1 and is_primary = true`, [memberId]);
  await db.query(
    `update member_door set biggest_impact = true, is_primary = true, noted_at = now()
     where member_id = $1 and door_slug = $2 and removed_at is null`,
    [memberId, slug],
  );
  // member_profile.named_door is the OTHER copy of "which Door is hers" and the dashboard reads it. Leaving it
  // stale is how the two disagree — the exact collision ruling #8 exists to close.
  await db.query(`update member_profile set named_door = $2 where member_id = $1`, [memberId, slug]);
  return true;
}

/**
 * She claimed the quiet-drift card. NOT a Door — see migration 0086 and D5 ruling #9.
 *
 * Idempotent on purpose: the timestamp records WHEN she first said it, and re-tapping should not rewrite her
 * history. Un-claiming clears it, because a card she unmarks is a statement too.
 */
export async function setQuietDriftClaim(db: Db, memberId: string, claimed: boolean): Promise<void> {
  await db.query(
    claimed
      ? `update member_profile set quiet_drift_claimed_at = coalesce(quiet_drift_claimed_at, now()) where member_id = $1`
      : `update member_profile set quiet_drift_claimed_at = null where member_id = $1`,
    [memberId],
  );
}

/** Has she claimed quiet drift? `null` = never asked, and must never render as "no". */
export async function quietDriftClaim(db: Db, memberId: string): Promise<Date | null> {
  const { rows } = await db.query<{ quiet_drift_claimed_at: Date | null }>(
    `select quiet_drift_claimed_at from member_profile where member_id = $1`,
    [memberId],
  );
  return rows[0]?.quiet_drift_claimed_at ?? null;
}

/** Every Door slug, board order applied by the caller — exported so a surface never hand-lists the taxonomy. */
export const ALL_DOOR_SLUGS: readonly DoorSlug[] = DOORS.map((d) => d.slug);
