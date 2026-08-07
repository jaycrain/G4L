'use server';

// Managing who can open the console. Every export here is an RPC endpoint (see lib/auth/verify-email.ts for what
// forgetting that cost us this morning), so every one of them re-checks isAdmin() rather than trusting the page.

import { revalidatePath } from 'next/cache';
import { isAdmin } from '../../authz.ts';
import { getDb } from '../../../lib/db/index.ts';
import { createOperator, disableOperator, enableOperator } from '../../../lib/auth/operator.ts';
import type { Db } from '../../../lib/db/schema.ts';

const MIN_PASSWORD = 12;

export async function addOperatorAction(
  name: string,
  email: string,
  password: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!(await isAdmin())) return { ok: false, message: 'Not authorized.' };
  const n = (name ?? '').trim();
  const e = (email ?? '').trim();
  if (!n || !e) return { ok: false, message: 'Name and email are both needed.' };
  // A LONGER FLOOR THAN MEMBERS GET, deliberately. One operator credential reads every member's identity story,
  // gap and transcripts. It should not be easier to guess than the thing it unlocks.
  if ((password ?? '').length < MIN_PASSWORD) {
    return { ok: false, message: `Use at least ${MIN_PASSWORD} characters — this password reads every member's story.` };
  }
  try {
    await createOperator((await getDb()) as unknown as Db, n, e, password);
    revalidatePath('/admin/operators');
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    if (/unique|duplicate/i.test(msg)) return { ok: false, message: 'There is already a live operator with that address.' };
    console.error('addOperator failed:', msg);
    return { ok: false, message: 'Could not add that operator.' };
  }
}

export async function setOperatorEnabledAction(id: string, enabled: boolean): Promise<{ ok: boolean }> {
  if (!(await isAdmin())) return { ok: false };
  const db = (await getDb()) as unknown as Db;
  // Disable, never delete — every access-log line names an operator, and an audit trail you can erase by
  // removing the actor is not an audit trail.
  if (enabled) await enableOperator(db, id);
  else await disableOperator(db, id);
  revalidatePath('/admin/operators');
  return { ok: true };
}
