# Runbook — RLS advisory & migration drift

**Use when:** Supabase emails an `rls_disabled_in_public` advisory ("Table publicly accessible"), or you suspect
the live DB is behind the repo's migrations.

**Root cause (the recurring one):** *apply-drift* — a migration lands in the repo but never gets run on the live
project, so a table that the migration would have protected is left readable/writable by the Data API (the
`anon`/`authenticated` PostgREST roles). The repo's migrations are guarded by `tests/rls-coverage.test.ts`; the
gap is getting them **applied to prod**.

**Safety facts (so you can act without fear):**
- Enabling RLS is **safe for the app** — the app connects as the table **owner**, which *bypasses* RLS. RLS-on
  with no policy = default-deny for the Data API roles only. (Same posture as migrations 0013 / 0039 / 0042.)
- All the SQL below is **read-only or idempotent** — re-running it can't hurt.
- Do prod DB changes in the **Supabase SQL Editor** (G4L project), not from the app/worktree.

---

## Steps (in order)

### 1. Stop the bleeding — enable RLS on every public table (idempotent)
Supabase SQL Editor → run:
```sql
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;
```
This clears the advisory immediately. (It's the body of `supabase/migrations/0042_enable_rls_sweep.sql`.)

### 2. See the full drift — which migrations are missing on prod
Run the diagnostic (read-only): paste the contents of **`scripts/db/migration-drift.sql`**.
- **No rows** → no drift; you're in sync.
- **Rows** → those migration numbers are **missing from the live DB** (the drift). Delete the `where applied =
  false` line to see all migrations applied/not.

> Keep the diagnostic current: it's generated from the migration sentinels. After adding migrations, regenerate
> with `node scripts/db/gen-migration-drift.mjs > scripts/db/migration-drift.sql`.

### 3. Apply any other missing migrations (oldest → newest)
For each missing `00NN` from step 2, run the contents of `supabase/migrations/00NN_*.sql` in the SQL Editor, in
order. (Migrations are written idempotently.) — *or*, if `npm run db:migrate` is pointed at the prod
`DATABASE_URL`, run that; the runner (`lib/db/schema.ts`) skips already-applied migrations via sentinels.

### 4. Verify
- Re-run `scripts/db/migration-drift.sql` → **zero rows**.
- Confirm no exposed tables:
  ```sql
  select tablename from pg_tables
  where schemaname = 'public' and rowsecurity = false and tablename not like '\_%'
  order by tablename;   -- expect: no rows
  ```
- Mark the Supabase advisory resolved (it re-scans on its own schedule).

---

## Don't let it recur
The real fix is making the repo and the live DB **unable to silently diverge**:
- **Add 0042 (and future sweeps) to the runner** — every migration must be both a file AND a row in the
  `MIGRATIONS` array in `lib/db/schema.ts` (sentinel = how to detect it's applied). A file alone is skipped.
- **Decide on auto-apply:** wire `npm run db:migrate` to run against prod on deploy (or a CI step), so a pushed
  migration always reaches the live DB. Until then, **after any migration PR, run step 2–3 against prod.**
- The static guard `tests/rls-coverage.test.ts` already blocks merging a CREATE-TABLE migration that forgets
  RLS — it does **not** catch apply-drift; this runbook does.
