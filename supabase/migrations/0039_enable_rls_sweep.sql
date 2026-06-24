-- 0039: Re-run the public-schema RLS sweep.
--
-- Why now: 0013 enabled RLS on every table that existed THEN, but its loop runs once — it does NOT
-- cover tables created later (0013's comment claiming otherwise is wrong). A table added after 0013
-- that didn't enable RLS in its own migration was left exposed to the Data API (PostgREST, the
-- anon/authenticated roles). Supabase's advisor flagged this (rls_disabled_in_public) — concretely,
-- system_health (0034). It matters more now that the anon key is published for Realtime.
--
-- Fix: re-sweep — enable RLS on EVERY current public table. Idempotent (no-op where already on).
-- Safe for the app: it connects as the table-OWNER role, which BYPASSES RLS; RLS-on + no-policy =
-- default-deny for the Data API roles. No policies added, RLS not FORCEd (the owner must keep
-- bypassing) — identical posture to 0013. App-layer authorizeMember/isAdmin stays the real control.
--
-- Recurrence: a future new table STILL needs RLS (this loop also runs once). The durable guard is the
-- static test tests/rls-coverage.test.ts, which fails CI if a CREATE TABLE migration has no matching
-- `enable row level security`. Until/unless that guard is in place, every new CREATE TABLE migration
-- must include `alter table <t> enable row level security;`.

create table if not exists _rls_sweep_0039 (note text);

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;
