// Phase-arc save/resume store (W-15). Persists the in-flight arc conversation (working state + transcript) keyed by
// (member_id, arc), so a refresh / crash / navigation mid-session resumes instead of losing the excavation. Transient —
// cleared when the arc completes. Post-onboarding, so an account exists: keyed by member_id, no per-device token.
// Framework-free so it's testable against pglite. Mirrors onboarding-session.ts (the pre-account analogue).

import type { Db } from '../db/schema.ts';
import type { ConvState, ConvMessage } from './onboarding.ts';
import { isTranscriptReadable } from '../admin/diagnostic.ts';

export type ArcName = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim';
export type ArcSession = { state: ConvState; messages: ConvMessage[] };

// The storage key in the `arc` text column. Reconnect is a single continuous session → its bare arc name. The
// multi-session arcs (rewire/rebuild/reclaim have W1/W2/W3/Checkpoint etc.) scope the key to the SESSION — otherwise
// two sessions in the same phase would clobber each other's in-flight transcript. latestArcSession() strips the
// suffix back to the phase, so the resume hero (which compares against a phase) keeps working unchanged.
function storageKey(arc: ArcName, session?: string): string {
  return session ? `${arc}:${session}` : arc;
}

export async function saveArcSession(
  db: Db,
  memberId: string,
  arc: ArcName,
  state: ConvState,
  messages: ConvMessage[],
  session?: string,
): Promise<void> {
  // ::text::jsonb forces the driver to parse the JSON once (a real jsonb object/array on both pglite and postgres.js),
  // never a double-encoded scalar string — the same guard as saveOnboardingSession.
  await db.query(
    `insert into arc_session (member_id, arc, state, messages, updated_at)
     values ($1,$2,$3::text::jsonb,$4::text::jsonb, now())
     on conflict (member_id, arc) do update
       set state = excluded.state, messages = excluded.messages, updated_at = now()`,
    [memberId, storageKey(arc, session), JSON.stringify(state), JSON.stringify(messages)],
  );
}

/** Resume the in-flight arc/session for this member, or null if none. Working state only (the account already exists). */
export async function loadArcSession(db: Db, memberId: string, arc: ArcName, session?: string): Promise<ArcSession | null> {
  const { rows } = await db.query<{ state: unknown; messages: unknown }>(
    'select state, messages from arc_session where member_id=$1 and arc=$2',
    [memberId, storageKey(arc, session)],
  );
  const r = rows[0];
  if (!r) return null;
  const state = (typeof r.state === 'string' ? JSON.parse(r.state) : r.state) as ConvState;
  const messages = (typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages) as ConvMessage[];
  return { state, messages: Array.isArray(messages) ? messages : [] };
}

/**
 * A FINISHED SESSION IS CLEARED — except for testers, whose transcript is RETAINED (Jay, 2026-09-03: "yes,
 * testers only").
 *
 * WHY. This row is a resume buffer, and deleting it on completion is right: the member's words are the most
 * sensitive thing the product holds, and everything we actually need from a Session — the Doors, the true lines,
 * the keepers, the readings — has already been extracted into its own record by the time we get here.
 *
 * But it means a FINISHED Session leaves no account of what was said. Donna hit a hard dead end in Reclaim C1 on
 * 2026-09-03 ("Something went wrong", three times, surviving a refresh) and by the time anyone looked, her
 * conversation had been deleted as she completed the Session. Her state was inspectable; her words were gone. The
 * only surviving evidence was a screenshot she happened to take.
 *
 * SCOPED TO THE ALLOWLIST, which is the whole reason this is safe to do at all. The same list that governs
 * reading a transcript now governs keeping one — people who know they are testing, named individually, with a
 * reason on the line. Every real member's row is still deleted on completion, exactly as before. The rule did not
 * change; the set it applies to did. See TRANSCRIPT_READABLE.
 *
 * RENAMED, NOT FLAGGED, so this needs no migration and no new column. A retained row is keyed `closed:<arc>:<ts>`,
 * which no live path can match: `loadArcSession` looks up an exact key, and `inFlightArcPhase` — the one query
 * that scans — excludes the prefix explicitly. The timestamp keeps a second walk of the same Session from
 * colliding with the first.
 */
export async function clearArcSession(db: Db, memberId: string, arc: ArcName, session?: string): Promise<void> {
  const key = storageKey(arc, session);
  try {
    const { rows } = await db.query<{ email: string }>('select email from member_profile where member_id=$1', [memberId]);
    if (isTranscriptReadable(rows[0]?.email ?? '')) {
      await db.query(
        `update arc_session set arc = 'closed:' || arc || ':' || extract(epoch from now())::bigint
          where member_id=$1 and arc=$2`,
        [memberId, key],
      );
      return;
    }
  } catch (e) {
    // A FAILURE HERE FALLS THROUGH TO THE DELETE, which is the privacy-preserving direction: if we cannot
    // establish that someone is a tester, we do not keep their conversation. Logged so it is not silent.
    console.error(`clearArcSession: could not check retention for member=${memberId}, deleting:`, (e as Error).message);
  }
  await db.query('delete from arc_session where member_id=$1 and arc=$2', [memberId, key]);
}

/** The member's in-flight arc PHASE (most-recently-updated), or null. A non-null result means a session is mid-way and
 *  resumable — the arc_session row is cleared on completion. Powers the resume-hero's top-priority "pick up where you
 *  left off" state (which compares against a phase, so we strip any `:session` suffix). Framework-free (pglite-testable). */
export async function latestArcSession(db: Db, memberId: string): Promise<ArcName | null> {
  const { rows } = await db.query<{ arc: string }>(
    // EXCLUDE RETAINED TRANSCRIPTS. A tester's finished Session is kept under a `closed:` key (see
    // clearArcSession); this is the only query that scans rather than looking up an exact key, so without
    // this a walker who FINISHED everything would show as mid-Session on their own dashboard.
    "select arc from arc_session where member_id=$1 and arc not like 'closed:%' order by updated_at desc limit 1",
    [memberId],
  );
  const key = rows[0]?.arc;
  return key ? ((key.split(':')[0] as ArcName) ?? null) : null;
}
