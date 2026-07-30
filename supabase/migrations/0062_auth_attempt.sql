-- 0062: Failed-authentication throttle (SEC-02).
--
-- There was NO rate limit, lockout, backoff, or failed-auth logging on any authentication endpoint:
--   * member login — a public Server Action, 8-char minimum passwords, unlimited attempts, no telemetry
--   * admin login  — one shared password, and the admin cookie makes authorizeMember return true for EVERY
--                    member, so a single guess reads every member's identity story, Playbook and transcripts
-- It also handed an unauthenticated caller an unbounded scrypt (16MB, 50–150ms) work-amplification primitive.
-- migrations/0009_accounts.sql deferred exactly this: "rate-limiting — is Path B, before real members."
-- Charter members are real people with real stories, so it is now before real members.
--
-- Append-only and deliberately tiny: one row per FAILED attempt. Successes clear the subject's rows, so the
-- table stays small on its own; a periodic prune of anything older than the window is optional, not required.
create table if not exists auth_attempt (
  attempt_id uuid primary key default gen_random_uuid(),
  scope      text        not null,  -- 'login_email' | 'login_ip' | 'admin_ip'
  subject    text        not null,  -- lower(email) or the caller IP — never a password or token
  created_at timestamptz not null default now()
);

-- The only query shape: count recent failures for (scope, subject).
create index if not exists auth_attempt_lookup_idx on auth_attempt (scope, subject, created_at desc);

alter table auth_attempt enable row level security;
-- No policies: the app connects direct-to-Postgres as its own role. RLS on + zero policies = the published
-- anon key can never read it (see the 0013/0039/0042 sweep history and the SEC-03 drift finding).
