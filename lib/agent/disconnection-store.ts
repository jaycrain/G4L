// Persistence for "raise once" — what the Companion has already pointed out. See lib/agent/disconnection.ts.

import type { Db } from '../db/schema.ts';
import type { Disconnection } from './disconnection.ts';

/**
 * Everything already raised for this member.
 *
 * THROWS ON A REAL FAILURE, deliberately. A swallowed read here would return [] — "nothing raised yet" — which is
 * indistinguishable from a clean slate and would make the Companion re-raise a settled observation on every turn.
 * A read that cannot see the record must not manufacture a confident answer about it.
 */
export async function loadRaisedNotices(db: Db, memberId: string): Promise<{ kind: string; subject: string }[]> {
  const { rows } = await db.query<{ kind: string; subject: string }>(
    `select kind, subject from companion_notice where member_id = $1`,
    [memberId],
  );
  return rows;
}

/**
 * Record that a disconnection was put in front of the model. Idempotent.
 *
 * MARKED ON SERVE, NOT ON UTTERANCE — a deliberate trade, and worth naming because it is the one lossy edge here.
 * We cannot know whether the model actually voiced it (matching its prose against the instruction would be exactly
 * the fuzzy inference this module exists to avoid). So the cost of being wrong is asymmetric and we choose the
 * survivable side: marking on serve can lose ONE observation, while marking on some guessed utterance would
 * re-raise a settled one repeatedly. Losing one is a smaller harm than nagging.
 *
 * Best-effort: a failure here must never break the member's turn. They are having a conversation; bookkeeping is
 * ours. (See telemetry-must-never-break-a-save — a metric in the write path once took down a live feature.)
 */
export async function markNoticeRaised(db: Db, memberId: string, d: Disconnection): Promise<void> {
  try {
    await db.query(
      `insert into companion_notice (member_id, kind, subject) values ($1, $2, $3)
       on conflict (member_id, kind, subject) do nothing`,
      [memberId, d.kind, d.subject],
    );
  } catch (e) {
    console.warn('companion_notice write failed (the member turn is unaffected):', (e as Error)?.message);
  }
}
