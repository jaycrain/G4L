'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { keepProposal, type KeeperProposal } from '../../lib/agent/harvest.ts';
import type { Db } from '../../lib/db/schema.ts';

// THE ONLY WAY A CONVERSATIONAL KEEPER REACHES THE PLAYBOOK — the member tapped Keep.
//
// Shared by every arc rather than duplicated per surface, because the whole point is that there is ONE answer to
// "how did this get in here?" Five copies of this would be five chances for one of them to drift back to
// committing without asking, which is the bug this replaces.
export async function keepProposalAction(
  memberId: string,
  proposal: KeeperProposal,
): Promise<{ ok: boolean; error?: string }> {
  // The proposal round-trips through the client, so it is UNTRUSTED input. authorizeMember is what makes that
  // safe: the write is scoped to a member the caller is allowed to act as, so the worst a tampered payload can do
  // is put the wrong text in their OWN Playbook — which they can already do by typing it.
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  if (!proposal?.body?.trim()) return { ok: false, error: 'Nothing to keep.' };
  try {
    const db = (await getDb()) as unknown as Db;
    await keepProposal(db, memberId, proposal);
    return { ok: true };
  } catch (e) {
    // LOG, never swallow silently. A swallowed failure here shows her "In your Playbook" over an empty Playbook,
    // and a confident lie about her own words is worse than the save failing visibly.
    console.error(`[keeper] keep failed for member=${memberId} (${proposal.label}):`, e);
    return { ok: false, error: 'Could not save that just now.' };
  }
}
