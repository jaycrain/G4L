'use server';

import { revalidatePath } from 'next/cache';
import { isAdmin } from '../../authz.ts';
import { getDb } from '../../../lib/db/index.ts';
import { markActivitySeen } from '../../../lib/founder/state.ts';

/**
 * "I've seen these." An EXPLICIT act, not a side effect of the page rendering.
 *
 * The first cut stamped the marker inside the page render. Every Founder Console page also auto-refreshes
 * every 30 seconds, so the marker chased its own tail: each tick marked everything seen, the count sat at
 * zero forever, and the console badge never appeared because Activity had already swallowed it. The feature
 * was invisible — Jay's exact words were "I'm lost on this implementation", and he was right to be.
 *
 * A render is not an intention. Stamping now requires a deliberate tap, which also makes the rule obvious:
 * nothing clears until you say so.
 */
export async function markActivitySeenAction(): Promise<void> {
  if (!(await isAdmin())) return;
  await markActivitySeen(await getDb(), new Date().toISOString());
  revalidatePath('/admin/activity');
  revalidatePath('/admin');
}
