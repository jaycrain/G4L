'use server';

import { randomBytes } from 'node:crypto';
import { getDb } from '../../lib/db/index.ts';
import { seedFreshMember, FRESH_EMAIL } from '../../lib/demo/fresh-member.ts';
import { isAdmin } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';

export type FreshResult =
  | { ok: true; email: string; password: string; memberId: string }
  | { ok: false; message: string };

/**
 * Reset the brand-new-member fixture and hand back credentials to sign in as them.
 *
 * WHY A BUTTON. The fixture has to be RE-RUN to be useful — the Opening Tour and the Threshold ceremony each
 * fire once per member, so watching either a second time means wiping the account first. A reset that requires
 * the production connection string in a terminal is a reset that happens once and then never again.
 *
 * WHAT IT CANNOT DO. The address is a constant, so there is no input to point this at a real member; the
 * fixture re-checks the .test suffix regardless; and every delete inside is scoped to that one member_id.
 * Admin-gated, and `isAdmin()` fails closed.
 *
 * The password is generated fresh each time and returned ONCE, to be read off the screen. It is never stored in
 * plaintext and never logged — the row holds a hash like any other credential.
 */
export async function resetFreshMemberAction(): Promise<FreshResult> {
  if (!(await isAdmin())) return { ok: false, message: 'Not authorized.' };
  // Typeable on purpose: it gets copied into a login form, sometimes on a phone.
  const password = `fresh-${randomBytes(6).toString('hex')}`;
  try {
    const memberId = await seedFreshMember((await getDb()) as unknown as Db, FRESH_EMAIL, password);
    return { ok: true, email: FRESH_EMAIL, password, memberId };
  } catch (e) {
    console.error('resetFreshMemberAction failed:', (e as Error).message);
    return { ok: false, message: (e as Error).message };
  }
}
