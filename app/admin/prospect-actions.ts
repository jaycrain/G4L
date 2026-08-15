'use server';

import { getDb } from '../../lib/db/index.ts';
import { revealProspectTranscript } from '../../lib/admin/prospects.ts';
import { isAdmin, currentOperator } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';

/**
 * BREAK-GLASS: show what someone still in onboarding actually wrote.
 *
 * Its own action file, and its own name, so this never becomes a routine read. The console lists prospects as
 * SHAPE — stage, turns, how long ago. That answers the operational questions. This answers a different one
 * ("what did they say?") about a person who is not a member, never finished signing up, and never agreed to
 * anything — so it is a deliberate act, and it leaves a record with the operator's name on it.
 *
 * The failure ordering is deliberate and lives in revealProspectTranscript: the access log is written FIRST,
 * and if that write fails the transcript is never returned. So the honest outcomes here are "shown and
 * recorded" or "not shown" — never "shown, unrecorded".
 */
export async function revealProspectAction(
  email: string,
): Promise<{ ok: true; turns: Array<{ role: string; text: string }> } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'Not authorized.' };
  const db = (await getDb()) as unknown as Db;
  const who = await currentOperator();
  try {
    const t = await revealProspectTranscript(db, email, { id: who.id, label: who.label });
    return { ok: true, turns: t.turns };
  } catch (e) {
    // Deliberately surfaced rather than swallowed. If the log is down, the operator should see "couldn't open
    // it" and know why — not get the words with no record that they did.
    console.error('prospect reveal refused (access log failed):', (e as Error).message);
    return { ok: false, error: 'Could not record the access, so the transcript was not opened. Try again.' };
  }
}
