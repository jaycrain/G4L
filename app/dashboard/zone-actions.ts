'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { detectZone, setZone } from '../../lib/time/zone-store.ts';

// A timezone says something about where a person is, so it is member data and goes through authorizeMember like
// every other write. The memberId arrives from the client, and a server action that trusted it would let anyone
// rewrite anyone's zone — which is both a privacy leak and a way to silently corrupt someone's dates.

/** Silent, from the browser. Never overwrites a zone the member chose — see detectZone. */
export async function recordZone(memberId: string, zone: string): Promise<void> {
  if (!(await authorizeMember(memberId))) return;
  await detectZone(await getDb(), memberId, zone);
}

/** The member choosing, deliberately. This one DOES overwrite. */
export async function chooseZone(memberId: string, zone: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  return setZone(await getDb(), memberId, zone);
}
