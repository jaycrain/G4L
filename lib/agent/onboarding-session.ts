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

/** Resume the in-flight onboarding for this email. **A valid device token is REQUIRED — no exceptions.**
 *
 * SECURITY (2026-07-30): this used to allow an EMPTY token to "recover by email", which defeated the very
 * invariant migration 0016 was written to hold ("only the device that started a session can resume it, so a
 * stranger can't resume someone's vulnerable answers by guessing an email"). Anyone who knew a prospect's email
 * could call the public resume action with token='' and receive their whole in-flight onboarding — the verbatim
 * transcript, the Door, the gap in their own first-person words, the Reclaim List — AND the resume token itself,
 * which then let them finalize the account under their OWN password, permanently locking the real person out.
 *
 * Losing an in-flight onboarding to cleared storage is recoverable (they start again). A stranger reading someone's
 * trauma and taking their account is neither. Recovery for a genuinely lost device must be rebuilt on PROOF of email
 * control (an emailed one-time link) — never on knowing the address. Pre-account working state; no account exists yet. */
/** Length-safe constant-time compare — resume tokens are bearer credentials for the member's most sensitive text. */
function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function loadOnboardingSession(db: Db, email: string, token: string): Promise<OnboardingSession | null> {
  const { rows } = await db.query<{ state: unknown; messages: unknown; token: string }>(
    'select state, messages, token from onboarding_session where email=$1',
    [email],
  );
  const r = rows[0];
  if (!r) return null;
  // Require a token, and compare in constant time so the check can't be probed byte-by-byte.
  if (!token || !tokensMatch(token, r.token)) return null;
  const state = (typeof r.state === 'string' ? JSON.parse(r.state) : r.state) as ConvState;
  const messages = (typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages) as ConvMessage[];
  return { state, messages: Array.isArray(messages) ? messages : [], token: r.token };
}

export async function clearOnboardingSession(db: Db, email: string): Promise<void> {
  await db.query('delete from onboarding_session where email=$1', [email]);
}
