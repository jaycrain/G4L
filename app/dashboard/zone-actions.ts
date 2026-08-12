'use server';

import { getDb } from '../../lib/db/index.ts';
import { currentMemberId } from '../auth.ts';
import { authorizeMember } from '../authz.ts';
import { detectZone, setZone } from '../../lib/time/zone-store.ts';

// A timezone says something about where a person is, so it is member data.
//
// THE MEMBER IS READ FROM THE SESSION, NEVER FROM THE CLIENT. An earlier version took a memberId argument, which
// would have let anyone rewrite anyone else's dates. There is no reason the browser needs to tell us who it is
// when the cookie already does.

/**
 * Silent detection from the browser. Never overwrites a zone the member chose — see detectZone.
 *
 * Returns whether a zone was actually recorded, and the caller uses that to decide whether to stop asking. It
 * matters because this runs on EVERY page: a visitor part-way through onboarding has no member_profile row yet,
 * so the write no-ops, and a caller that treated "I posted once" as "done" would then never detect them again in
 * that browser session — the zone would silently stay null for exactly the members who are newest.
 */
export async function recordZone(zone: string): Promise<boolean> {
  const memberId = await currentMemberId();
  if (!memberId) return false; // logged out — nothing to attach a zone to
  await detectZone(await getDb(), memberId, zone);
  return true;
}

/** The member choosing, deliberately. This one DOES overwrite. */
export async function chooseZone(memberId: string, zone: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  return setZone(await getDb(), memberId, zone);
}
