'use server';

// "SHE ACTUALLY SAW IT" — the half of a badge the server cannot know on its own.
//
// Everything else about a badge is server-side and certain: the row exists or it does not. Whether the member
// ever LAID EYES on it is a fact that only exists on her screen, and until now we recorded nothing about it.
// Donna earned 15 badges and asked "was I getting a notification at all?" — a question the product could not
// answer for her, or for anyone, because the only evidence would have been someone watching her walk.
//
// This is called from BadgeReveal's mount (app/dashboard/badge-reveal.tsx), so it fires when the badge is drawn
// rather than when a payload containing a badge is returned. That distinction is the whole point: on 2026-09-04
// Jennifer's ceremony announced a badge she did not own, and a server-side "we sent one" would have recorded
// that lie as a success.

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { logEvent } from '../../lib/telemetry/store.ts';
import { getBadge } from '../../lib/curriculum/registry.ts';
import type { Db } from '../../lib/db/schema.ts';

/** Where a member can be shown a badge. Kept small and closed — an unknown surface is dropped, not guessed. */
const SURFACES = new Set(['ceremony', 'handhome', 'shelf']);

/**
 * Record that a badge was rendered to this member. Best-effort and silent by design: this runs during a
 * ceremony, and a telemetry failure must never interrupt the one moment in the program that is pure reward.
 */
export async function recordBadgeShownAction(memberId: string, badgeId: string, surface: string): Promise<void> {
  try {
    if (!(await authorizeMember(memberId))) return;
    if (!SURFACES.has(surface)) return;
    // An id nothing knows is the silent-failure shape this whole feature exists to end — if the reveal is
    // drawing a badge the registry cannot name, that is worth seeing in the data rather than recording blank.
    if (!getBadge(badgeId)) return;
    const db = (await getDb()) as unknown as Db;
    await logEvent(db, memberId, 'badge_shown', { surface, ref: badgeId, meta: { badgeId } });
  } catch {
    /* swallow — a badge that fails to be COUNTED must still be a badge that was SEEN */
  }
}
