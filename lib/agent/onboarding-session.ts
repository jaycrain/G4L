// Onboarding save/resume store. Persists the in-flight conversation (state + transcript) keyed by
// email + a per-device token, so a hang / refresh / crash can resume instead of losing everything.
// Transient — cleared on completion. (We do NOT keep the verbatim transcript after completion; this
// is working state only.) Framework-free so it's testable against pglite.

import type { Db } from '../db/schema.ts';
import type { ConvState, ConvMessage } from './onboarding.ts';

export type OnboardingSession = { state: ConvState; messages: ConvMessage[]; token: string };

export async function saveOnboardingSession(
  db: Db,
  email: string,
  token: string,
  state: ConvState,
  messages: ConvMessage[],
): Promise<void> {
  // Cast the already-stringified JSON through ::text::jsonb. Without the explicit ::text, the prod
  // driver (postgres.js) re-encodes a JSON string param as a jsonb *scalar string* (double-encoding);
  // ::text forces it to parse the JSON once, storing a real jsonb object/array on both drivers.
  // (loadOnboardingSession still defensively re-parses, so a legacy double-encoded row reads fine too.)
  await db.query(
    `insert into onboarding_session (email, token, state, messages, updated_at)
     values ($1,$2,$3::text::jsonb,$4::text::jsonb, now())
     on conflict (email) do update
       set token = excluded.token, state = excluded.state, messages = excluded.messages, updated_at = now()`,
    [email, token, JSON.stringify(state), JSON.stringify(messages)],
  );
}

/** Resume the in-flight onboarding for this email. A matching device token always resumes. A device
 * with NO token (empty — it was lost to a force-quit / cleared storage) may RECOVER the session by
 * email, and adopt its token. A WRONG (non-empty) token never resumes — so you can't hijack another
 * in-flight onboarding by guessing the email. Pre-account working state only; no account exists yet. */
export async function loadOnboardingSession(db: Db, email: string, token: string): Promise<OnboardingSession | null> {
  const { rows } = await db.query<{ state: unknown; messages: unknown; token: string }>(
    'select state, messages, token from onboarding_session where email=$1',
    [email],
  );
  const r = rows[0];
  if (!r) return null;
  if (token && r.token !== token) return null; // a present-but-wrong token is denied (no email hijack)
  const state = (typeof r.state === 'string' ? JSON.parse(r.state) : r.state) as ConvState;
  const messages = (typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages) as ConvMessage[];
  return { state, messages: Array.isArray(messages) ? messages : [], token: r.token };
}

export async function clearOnboardingSession(db: Db, email: string): Promise<void> {
  await db.query('delete from onboarding_session where email=$1', [email]);
}
