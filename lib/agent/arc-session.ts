// Phase-arc save/resume store (W-15). Persists the in-flight arc conversation (working state + transcript) keyed by
// (member_id, arc), so a refresh / crash / navigation mid-session resumes instead of losing the excavation. Transient —
// cleared when the arc completes. Post-onboarding, so an account exists: keyed by member_id, no per-device token.
// Framework-free so it's testable against pglite. Mirrors onboarding-session.ts (the pre-account analogue).

import type { Db } from '../db/schema.ts';
import type { ConvState, ConvMessage } from './onboarding.ts';

export type ArcName = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim';
export type ArcSession = { state: ConvState; messages: ConvMessage[] };

export async function saveArcSession(
  db: Db,
  memberId: string,
  arc: ArcName,
  state: ConvState,
  messages: ConvMessage[],
): Promise<void> {
  // ::text::jsonb forces the driver to parse the JSON once (a real jsonb object/array on both pglite and postgres.js),
  // never a double-encoded scalar string — the same guard as saveOnboardingSession.
  await db.query(
    `insert into arc_session (member_id, arc, state, messages, updated_at)
     values ($1,$2,$3::text::jsonb,$4::text::jsonb, now())
     on conflict (member_id, arc) do update
       set state = excluded.state, messages = excluded.messages, updated_at = now()`,
    [memberId, arc, JSON.stringify(state), JSON.stringify(messages)],
  );
}

/** Resume the in-flight arc for this member, or null if none. Working state only (the account already exists). */
export async function loadArcSession(db: Db, memberId: string, arc: ArcName): Promise<ArcSession | null> {
  const { rows } = await db.query<{ state: unknown; messages: unknown }>(
    'select state, messages from arc_session where member_id=$1 and arc=$2',
    [memberId, arc],
  );
  const r = rows[0];
  if (!r) return null;
  const state = (typeof r.state === 'string' ? JSON.parse(r.state) : r.state) as ConvState;
  const messages = (typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages) as ConvMessage[];
  return { state, messages: Array.isArray(messages) ? messages : [] };
}

export async function clearArcSession(db: Db, memberId: string, arc: ArcName): Promise<void> {
  await db.query('delete from arc_session where member_id=$1 and arc=$2', [memberId, arc]);
}
