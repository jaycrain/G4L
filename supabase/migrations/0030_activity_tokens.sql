-- 0030: OAuth tokens + consent for activity connections (Path B — Strava connect goes live).
-- 0007 deliberately deferred these until auth + token encryption landed; they land here.
--
-- Tokens are stored ENCRYPTED at rest (AES-256-GCM, see lib/activity/crypto.ts) — the columns
-- hold ciphertext, never plaintext. RLS is already on for this table (0013) and the app connects
-- as the table owner (bypasses RLS); these columns are additionally never exposed in logs.
--
-- consent_granted_at records the explicit, member-given consent that gates the connect (Path B
-- health data is consent-gated per the AI Governance Framework). Null = not (yet) consented.
alter table activity_connection
  add column if not exists access_token_enc  text,
  add column if not exists refresh_token_enc text,
  add column if not exists token_expires_at  timestamptz,
  add column if not exists scope             text,
  add column if not exists athlete_id        text,
  add column if not exists consent_granted_at timestamptz,
  add column if not exists last_synced_at    timestamptz;
