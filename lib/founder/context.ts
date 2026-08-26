// Assembles the FounderContext for a member from the warehouse — the only facts the Founder
// Agent is allowed to use when drafting. Framework-free (takes a Db) so both the admin action
// and the auto-triggers share one source of truth.

import type { Db } from '../db/schema.ts';
import { getDashboard } from '../gateway/flow.ts';
import { firstName } from '../member/avatar.ts';
import { getMemberExperience } from '../telemetry/store.ts';
import { getAsset } from '../curriculum/registry.ts';
import type { FounderContext } from './draft.ts';

export async function buildFounderContext(
  db: Db,
  memberId: string,
  opts?: { lastCompletedAsset?: string | null },
): Promise<FounderContext | null> {
  const dash = await getDashboard(db, memberId);
  if (!dash) return null;
  const [prof, experience] = await Promise.all([
    db
      // intake_gap, NOT intake_right_now (2026-08-26). The Founder Agent's drafts quote this as "Their intake
      // words" — the one line of the member's own voice in a note written in Jay's name. It read
      // `intake_right_now`, which signup writes as a LITERAL EMPTY STRING and the staged onboarding never fills:
      // permanently blank, for every member who has ever signed up, so the draft silently dropped the clause.
      //
      // The gap IS their intake words, in their own first person, and it is what the whole product is built on
      // top of. coalesce nullif so a legacy '' still reads as absent rather than as an empty quotation.
      .query<{ intake_right_now: string | null }>(
        `select coalesce(nullif(intake_gap, ''), nullif(intake_right_now, '')) as intake_right_now
           from member_profile where member_id = $1`,
        [memberId],
      )
      .then((r) => r.rows[0]),
    getMemberExperience(db, memberId, (id) => getAsset(id)?.title ?? id),
  ]);
  return {
    firstName: firstName(dash.displayName || ''),
    identityNoun: dash.identityNoun,
    doorDisplayNames: dash.doors.map((d) => d.displayName),
    reclaimList: dash.reclaimList,
    idScore: dash.score?.score ?? null,
    direction: dash.score?.direction ?? null,
    delta: dash.score?.delta ?? null,
    currentFocus: dash.currentFocus?.label ?? null,
    lastCompletedAsset: opts?.lastCompletedAsset ?? null,
    intakeQuote: prof?.intake_right_now ?? null,
    experienceSummary: experience.summary || null,
  };
}
