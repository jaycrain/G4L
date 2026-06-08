// Assembles the FounderContext for a member from the warehouse — the only facts the Founder
// Agent is allowed to use when drafting. Framework-free (takes a Db) so both the admin action
// and the auto-triggers share one source of truth.

import type { Db } from '../db/schema.ts';
import { getDashboard } from '../gateway/flow.ts';
import { firstName } from '../member/avatar.ts';
import type { FounderContext } from './draft.ts';

export async function buildFounderContext(
  db: Db,
  memberId: string,
  opts?: { lastCompletedAsset?: string | null },
): Promise<FounderContext | null> {
  const dash = await getDashboard(db, memberId);
  if (!dash) return null;
  const prof = (
    await db.query<{ intake_right_now: string | null }>(
      'select intake_right_now from member_profile where member_id = $1',
      [memberId],
    )
  ).rows[0];
  return {
    firstName: firstName(dash.displayName || ''),
    identityNoun: dash.identityNoun,
    doorDisplayName: dash.door?.displayName ?? null,
    idScore: dash.score?.score ?? null,
    direction: dash.score?.direction ?? null,
    delta: dash.score?.delta ?? null,
    currentFocus: dash.currentFocus?.label ?? null,
    lastCompletedAsset: opts?.lastCompletedAsset ?? null,
    intakeQuote: prof?.intake_right_now ?? null,
  };
}
