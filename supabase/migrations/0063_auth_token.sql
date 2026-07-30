-- 0063: Single-use, expiring auth tokens — password reset + email verification (SEC-08).
--
-- Accounts were provisioned on UNVERIFIED emails with no reset and no recovery of any kind:
--   * anyone could sign up as any address they could type
--   * a member who forgot their password was locked out permanently, with no path back
--   * it made SEC-01 (the onboarding takeover) irreversible — the real person had no way to reclaim
--     an account built from their own story
-- It also left "lost device" onboarding recovery with nowhere safe to go, since the old recovery-by-
-- email-alone was the vulnerability itself. Proof of email control is the primitive all of that needs.
--
-- WE STORE ONLY A HASH. The token is a bearer credential that can reset a password, so a database read
-- (backup, log, snapshot, or an RLS gap) must not yield anything replayable — same reasoning as password
-- hashing. The plaintext exists only in the email we send.
create table if not exists auth_token (
  token_id    uuid        primary key default gen_random_uuid(),
  token_hash  text        not null unique,           -- sha-256 of the emailed token; never the token itself
  purpose     text        not null,                  -- 'password_reset' | 'verify_email'
  email       text        not null,                  -- lower-cased; the address that must be proven
  member_id   uuid        references member_profile(member_id) on delete cascade,
  expires_at  timestamptz not null,
  consumed_at timestamptz,                           -- single use: set the moment it is redeemed
  created_at  timestamptz not null default now()
);

create index if not exists auth_token_hash_idx  on auth_token (token_hash);
create index if not exists auth_token_email_idx on auth_token (email, purpose, created_at desc);

alter table auth_token enable row level security;
-- No policies: the app connects direct-to-Postgres as its own role; the published anon key must never
-- reach this table (see 0013/0039/0042 sweep history + the Data API being disabled).

-- Proof-of-control for the signup address. DELIBERATELY NOT A GATE: an unverified member keeps full access.
-- Hard-gating would strand real Charter members behind our own email deliverability, and this is a product a
-- member has already told their story to — locking them out of it to prove a point is the worse failure. The
-- column is the RECORD, so we can see who has proven the address (admin/diagnostic) and require proof later
-- for the things that actually matter (recovery, and any future address change).
alter table member_credential add column if not exists email_verified_at timestamptz;
