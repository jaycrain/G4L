-- 0073: operator + member_access_log — give admin access an IDENTITY, and record who opened whose story.
--
-- WHY. `isAdmin()` returns a boolean, not a person (app/authz.ts). Thirty-odd admin surfaces learn THAT the caller
-- is an admin and never WHICH, so there is nowhere in the system an action could be attributed to a human even if we
-- wanted to. Three consequences: no attribution; no revocation short of rotating one shared password for everyone;
-- and no answer to the question a member is entitled to ask — who looked at my file. We hold the disclosures of
-- people who were promised somewhere it is safe to be honest, and "we can't tell" is a bad answer to that.
--
-- THE AUDIT STORY IS INVERTED RELATIVE TO THE RISK, and this fixes that. Migration 0032 logs every member_profile
-- WRITE. But the sensitive operation here is the READ: a Reclaim List, a gap, a transcript are valuable to an
-- intruder because they can be SEEN, not because they can be edited. So we audit reads of an individual's record.
--
-- WHAT IS NOT LOGGED, on purpose: roster and aggregate views. Logging every list render buries the signal in noise,
-- and the roster is not where the story lives. The unit is "an operator opened ONE member" — a concept the code
-- already has (lib/founder/companion-tools.ts caps budget.openedMembers per turn); it counted them and forgot them.
--
-- OPERATORS ARE NEVER DELETED, only disabled. A deleted operator would orphan the log entries that name them, and an
-- audit trail you can erase by removing the actor is not an audit trail. `disabled_at` is the revocation.
--
-- ADMIN_PASSWORD SURVIVES as (a) the HMAC signing key for the admin cookie and (b) a bootstrap credential that logs
-- in as the built-in 'root' operator. Without (b) the first deploy after this migration locks everyone out of the
-- console. It is meant to be retired once real operators exist.
--
-- Additive + idempotent. RLS enabled, no policy — the owner connection bypasses; default-deny for Data API roles.

create table if not exists operator (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null,
  -- scrypt$salt$hash, produced by lib/auth/password.ts — the SAME hashing members get, deliberately. An operator
  -- credential unlocks every member's story, so it has no business being weaker than the credential it can read.
  password_hash text not null,
  created_at    timestamptz not null default now(),
  disabled_at   timestamptz
);

-- One live operator per address. Partial, so a disabled operator's address can be reissued to a new person without
-- rewriting history — the old row (and every log entry naming it) stays exactly as it was.
create unique index if not exists operator_email_live_idx
  on operator (lower(email)) where disabled_at is null;

create table if not exists member_access_log (
  id             bigserial primary key,
  at             timestamptz not null default now(),
  -- Null for the bootstrap 'root' login, which has no operator row by design.
  operator_id    uuid references operator (id) on delete set null,
  -- Denormalised on purpose. The label is what the log MEANS; resolving it through a join would make the entry
  -- change if the operator is later renamed, and an audit line that rewrites itself is worthless.
  operator_label text not null,
  member_id      uuid not null,
  -- Which door they came through: 'admin_member_page' | 'diagnostic_api' | 'founder_companion'.
  surface        text not null,
  note           text
);

-- The two questions this table exists to answer: "who has looked at THIS member?" and "what did THIS operator
-- open?" Both want time-ordered results, hence the descending second column.
create index if not exists member_access_log_member_idx   on member_access_log (member_id, at desc);
create index if not exists member_access_log_operator_idx on member_access_log (operator_id, at desc);

alter table operator          enable row level security;
alter table member_access_log enable row level security;
