'use server';

import { adminLogout } from '../../authz.ts';

/** Drop the admin cookie. No isAdmin() gate on purpose: signing out is only ever destructive to the caller's own
 *  session, and refusing it to someone who is already signed out would be pointless. */
export async function adminSignOutAction(): Promise<void> {
  await adminLogout();
}
