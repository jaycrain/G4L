-- 0064: Hash session tokens at rest (SEC-12) + expiry hygiene for the pre-account tables (SEC-15).
--
-- member_session.token held the RAW bearer token — byte for byte the string in the member's cookie. Anyone able
-- to read that table (a backup, a log line, a snapshot, an RLS gap, an ops export, a support screenshot) could
-- paste a row straight into a cookie and BE that member: their identity story, their Doors, their Playbook, no
-- password required and no trace left. Same reasoning as hashing passwords, and the same reasoning we already
-- applied to auth_token in 0063 — this table was simply missed.
--
-- Unsalted sha-256 is correct here, not a shortcut: the input is 256 bits of CSPRNG output, so it is neither
-- guessable nor rainbow-tableable, and session lookup has to stay one indexed probe on every request.

alter table member_session add column if not exists token_hash text;

-- BACKFILL rather than wipe. We still hold the raw tokens, so we can hash them in place and NOBODY IS SIGNED OUT
-- — the digest here is byte-identical to the app's createHash('sha256').update(token).digest('hex').
--
-- Best-effort by design: pgcrypto exists on Supabase but not on pglite (the test/dev engine), and a fresh
-- database has no sessions to carry over anyway. Failing the whole migration over a backfill that only matters
-- on one engine would be the tail wagging the dog — worst case here is that live sessions log in again.
do $$
begin
  create extension if not exists pgcrypto;
  update member_session set token_hash = encode(digest(token, 'sha256'), 'hex') where token_hash is null;
exception when others then
  raise notice 'member_session backfill skipped (pgcrypto unavailable) — existing sessions will need a fresh login';
end $$;

-- DEPLOY ORDER SAFETY — this is why the old column survives.
-- Prod migrations are applied by hand, so the new code and this migration never land at the same instant. If we
-- dropped `token` (or left it NOT NULL as the primary key), one ordering breaks LOGIN FOR EVERYONE: apply-first
-- and the still-deployed old code can't insert; deploy-first and the new code writes a column that doesn't exist
-- yet. Leaving `token` present but nullable makes BOTH versions work during the window. A later migration drops
-- it, once no old code can be running.
alter table member_session drop constraint if exists member_session_pkey;
alter table member_session alter column token drop not null;

create unique index if not exists member_session_token_hash_uniq on member_session (token_hash);
create index if not exists member_session_member_idx on member_session (member_id);

-- EXPIRY HYGIENE (SEC-15). Nothing ever deleted expired sessions, spent auth tokens, or abandoned onboarding
-- sessions. That is not merely clutter: an abandoned onboarding row holds the most vulnerable text in the whole
-- product — the gap, in the member's own first-person words — for somebody who never even finished signing up.
-- Keeping it forever contradicts "minimum necessary data" for a person who never became a member.
create or replace function purge_expired_auth() returns void language sql as $$
  delete from member_session where expires_at < now();
  delete from auth_token where expires_at < now() - interval '7 days';
  delete from onboarding_session where updated_at < now() - interval '30 days';
$$;
