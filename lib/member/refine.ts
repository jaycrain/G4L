// Member-initiated refinement of their own core records — additive only. Used by the Member Agent's
// governed tools so a member can add to / sharpen their Reclaim List and add Door(s) in conversation,
// instead of a bolt-on page. Deleting or editing items that already carry progress is deliberately
// NOT here (state-machine + Journey integrity) — see the deferred follow-up.

import type { Db } from '../db/schema.ts';
import { addReclaimItems, getReclaimItems } from '../beats/store.ts';
import { inferCategory, isVagueReclaim } from '../beats/category.ts';
import { DOORS, matchDoors, isDoorSlug, type DoorSlug } from '../doors.ts';

const doorDisplay = (slug: DoorSlug) => DOORS.find((d) => d.slug === slug)?.displayName ?? slug;

export type AddReclaimResult =
  | { ok: true; text: string; category: string }
  | { ok: false; reason: 'empty' | 'vague' | 'duplicate' };

/**
 * Add ONE item to the member's Reclaim List. Refuses fog (a feeling/inner state) so the Beat engine
 * can actually bind work to it, infers the IDQ-dimension category, and appends (never reorders or
 * drops existing items, so the ≥3 contract can't be violated by an add).
 */
export async function addReclaimItemForMember(db: Db, memberId: string, rawText: string): Promise<AddReclaimResult> {
  const text = (rawText ?? '').trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (isVagueReclaim(text)) return { ok: false, reason: 'vague' };
  const existing = await getReclaimItems(db, memberId);
  if (existing.some((i) => i.text.trim().toLowerCase() === text.toLowerCase())) {
    return { ok: false, reason: 'duplicate' };
  }
  const category = inferCategory(text);
  await addReclaimItems(db, memberId, [{ text, category }]);
  return { ok: true, text, category };
}

export type AddDoorResult =
  | { ok: true; added: string[] }
  | { ok: false; reason: 'nomatch' | 'already' };

/**
 * Record additional Fade Door(s) from the member's own words. Maps free text to the canonical Doors,
 * adds only ones they don't already have (additive), and makes the first Door primary if they had none.
 */
export async function addDoorForMember(db: Db, memberId: string, description: string): Promise<AddDoorResult> {
  const matched = matchDoors(description ?? '');
  if (matched.length === 0) return { ok: false, reason: 'nomatch' };

  const existingRows = (
    await db.query<{ door_slug: string; is_primary: boolean; sort_order: number }>(
      'select door_slug, is_primary, sort_order from member_door where member_id=$1',
      [memberId],
    )
  ).rows;
  const existing = new Set(existingRows.filter((r) => isDoorSlug(r.door_slug)).map((r) => r.door_slug));
  const hadPrimary = existingRows.some((r) => r.is_primary === true);

  const added: DoorSlug[] = [];
  let order = existingRows.length;
  for (const slug of matched) {
    if (existing.has(slug)) continue;
    const isPrimary = !hadPrimary && added.length === 0;
    await db.query(
      `insert into member_door (member_id, door_slug, is_primary, sort_order)
       values ($1,$2,$3,$4) on conflict (member_id, door_slug) do nothing`,
      [memberId, slug, isPrimary, order],
    );
    added.push(slug);
    existing.add(slug);
    order++;
  }

  if (added.length === 0) return { ok: false, reason: 'already' };
  // Keep named_door (the single-value primary used by some reads) in sync if there wasn't one.
  if (!hadPrimary) await db.query('update member_profile set named_door=$2 where member_id=$1', [memberId, added[0]]);
  return { ok: true, added: added.map(doorDisplay) };
}
