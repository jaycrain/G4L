-- 0009: member accounts (preview-grade auth). Credentials are isolated from member_profile;
-- server-side sessions (revocable) back an httpOnly cookie. Production hardening — RLS, password
-- reset, email verification, rate-limiting — is Path B, before real members.
create table if not exists member_credential (
  member_id uuid primary key references member_profile(member_id) on delete cascade,
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists member_credential_email_uniq on member_credential (lower(email));

create table if not exists member_session (
  token text primary key,
  member_id uuid not null references member_profile(member_id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists member_session_member_idx on member_session (member_id);
