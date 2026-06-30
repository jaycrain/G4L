-- 0042: Re-run the public-schema RLS sweep (live drift fix).
--
-- Why now: on 28 Jun 2026 Supabase's advisor flagged rls_disabled_in_public on the live G4L project — a
-- public table readable/writable by the Data API (PostgREST anon/authenticated roles) because RLS was off.
-- Our migrations are clean (the static guard tests/rls-coverage.test.ts passes: reclaim_item → 0014,
-- system_health → swept by 0039, every connect_* table enables RLS in its own migration). So this is DRIFT:
-- a prior sweep/migration (very likely 0039) was not applied to the live project, leaving a post-0013 table
-- exposed. Re-sweeping from a tracked migration makes the live DB match the code regardless of which table.
--
-- Fix: enable RLS on EVERY current public table. Idempotent (no-op where already on). Safe for the app: it
-- connects as the table-OWNER role, which BYPASSES RLS; RLS-on + no-policy = default-deny for the Data API
-- roles. No policies added, RLS not FORCEd (the owner must keep bypassing) — identical posture to 0013/0039.
-- App-layer authorizeMember/isAdmin stays the real control.
--
-- IMPORTANT — this only helps once it's APPLIED TO THE LIVE PROJECT. The drift exists because a migration
-- wasn't run on prod; committing this file does not change the live DB. Run it (or just the DO-block below)
-- in the Supabase SQL Editor against the G4L project, then re-check the advisor.
--
-- Recurrence guard: tests/rls-coverage.test.ts fails CI if a future CREATE TABLE migration omits RLS. The
-- remaining gap this exposed is APPLY drift (migrations not reaching prod) — worth a deliberate check that
-- prod migration state matches the repo.

create table if not exists _rls_sweep_0042 (note text);

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;
