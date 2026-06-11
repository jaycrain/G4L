// Onboarding save/resume store. Persists the in-flight conversation (state + transcript) keyed by
// email + a per-device token, so a hang / refresh / crash can resume instead of losing everything.
// Transient — cleared on completion. (We do NOT keep the verbatim transcript after completion; this
// is working state only.) Framework-free so it's testable against pglite.

import type { Db } from '../db/schema.ts';
import type { ConvState, ConvMessage } from './onboarding.ts';

export type OnboardingSession = { state: ConvState; messages: ConvMessage[] };

export async function saveOnboardingSession(
  db: Db,
  email: string,
  token: string,
  state: ConvState,
  messages: ConvMessage[],
): Promise<void> {
  await db.query(
    `insert into onboarding_session (email, token, state, messages, updated_at)
     values ($1,$2,$3::jsonb,$4::jsonb, now())
     on conflict (email) do update
       set token = excluded.token, state = excluded.state, messages = excluded.messages, updated_at = now()`,
    [email, token, JSON.stringify(state), JSON.stringify(messages)],
  );
}

/** Returns the saved session ONLY if the token matches (per-device resume). Null otherwise. */
export async function loadOnboardingSession(db: Db, email: string, token: string): Promise<OnboardingSession | null> {
  const { rows } = await db.query<{ state: unknown; messages: unknown; token: string }>(
    'select state, messages, token from onboarding_session where email=$1',
    [email],
  );
  const r = rows[0];
  if (!r || r.token !== token) return null;
  const state = (typeof r.state === 'string' ? JSON.parse(r.state) : r.state) as ConvState;
  const messages = (typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages) as ConvMessage[];
  return { state, messages: Array.isArray(messages) ? messages : [] };
}

export async function clearOnboardingSession(db: Db, email: string): Promise<void> {
  await db.query('delete from onboarding_session where email=$1', [email]);
}
