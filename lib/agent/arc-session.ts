// Phase-arc save/resume store (W-15). Persists the in-flight arc conversation (working state + transcript) keyed by
// (member_id, arc), so a refresh / crash / navigation mid-session resumes instead of losing the excavation. Transient —
// cleared when the arc completes. Post-onboarding, so an account exists: keyed by member_id, no per-device token.
// Framework-free so it's testable against pglite. Mirrors onboarding-session.ts (the pre-account analogue).

import type { Db } from '../db/schema.ts';
import type { ConvState, ConvMessage } from './onboarding.ts';

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

export async function clearArcSession(db: Db, memberId: string, arc: ArcName, session?: string): Promise<void> {
  await db.query('delete from arc_session where member_id=$1 and arc=$2', [memberId, storageKey(arc, session)]);
}

/** The member's in-flight arc PHASE (most-recently-updated), or null. A non-null result means a session is mid-way and
 *  resumable — the arc_session row is cleared on completion. Powers the resume-hero's top-priority "pick up where you
 *  left off" state (which compares against a phase, so we strip any `:session` suffix). Framework-free (pglite-testable). */
export async function latestArcSession(db: Db, memberId: string): Promise<ArcName | null> {
  const { rows } = await db.query<{ arc: string }>(
    'select arc from arc_session where member_id=$1 order by updated_at desc limit 1',
    [memberId],
  );
  const key = rows[0]?.arc;
  return key ? ((key.split(':')[0] as ArcName) ?? null) : null;
}
