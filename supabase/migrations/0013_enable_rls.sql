-- 0013: Enable Row-Level Security on every table in the public schema.
--
-- Why: Supabase exposes the public schema through its auto-generated Data API (PostgREST) to the
-- anon/authenticated roles. With RLS OFF, those roles can read/write every row — the advisories
-- rls_disabled_in_public + sensitive_columns_exposed (member_credential.password_hash,
-- member_profile PII, member_session tokens).
--
-- Why this is safe for the app: the app connects over a direct pooled Postgres connection as the
-- table-OWNER `postgres` role, which BYPASSES RLS. So enabling RLS changes nothing for the app,
-- while the Data API roles get DEFAULT-DENIED (RLS on + no policy = zero rows visible).
--
-- We intentionally add NO policies and do NOT FORCE RLS: app-layer isolation (authorizeMember)
-- remains the access control, and the owner connection must keep bypassing. DB-level policies for
-- the anon/authenticated roles land if/when the Data API is ever used (multi-tenant switch-on),
-- under senior security review.
--
-- Idempotent: ENABLE ROW LEVEL SECURITY is a no-op when already enabled, and the loop covers any
-- future tables too. The marker table below is this migration's apply-sentinel.

create table if not exists _rls_enabled (note text);

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;
