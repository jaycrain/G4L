# Supabase

Schema and reference data for the G4L platform. Postgres on Supabase is the **program
spine** (Member Agent Tech Spec v1.1 §2.2): every member's IDQ trajectory, asset
completions, behavioral signals, and the data-governance enforcement layer (RLS).

## Files

- `migrations/0001_gateway_schema.sql` — the Gateway slice: `member_profile`, `idq_retake`,
  `member_profile_audit`, `asset_event` (telemetry), plus reference tables `door`,
  `idq_dimension`, `atlas_asset`.
- `seed/0001_reference_data.sql` — the 8 Doors, 4 IDQ dimensions, 12 gated assets (idempotent).

## Apply (local dev)

With the Supabase CLI and a local stack (`supabase start`):

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_gateway_schema.sql
psql "$DATABASE_URL" -f supabase/seed/0001_reference_data.sql
```

> Not yet applied to any database — this is schema-for-review. Once a Supabase project (or
> local stack) exists, apply and we'll wire the app. The SQL targets Postgres 15+ /
> Supabase conventions (`gen_random_uuid`, `jsonb`, `timestamptz`).

## Design notes

- **Scoring is corrected to the May 2026 cascade** (see `docs/CONTRACTS.md §1–2`): dimensions
  Physical/Self/Social/Outlook, per-dimension raw 6–30, ID Score raw 24–120, normalized 0–100,
  **no bands**. The MA v1.1 spec's "0–25" and band language are stale.
- **`reclaim_list`** is constrained to exactly 7 items once set (frozen contract, `CONTRACTS §6`).
- **No `phase` column** — the dashboard shows "current focus" (`CONTRACTS §4`); Rewire/Rebuild
  dosing is derived from IDQ subscores, not stored as a linear phase.
- **`tenant_id` defaults to `'public'`** on member-scoped tables to lay the multi-tenant
  foundation. **RLS is dormant** in `0001` — enabled in a later migration when a corporate
  tenant is funded (P3). See the RLS TODO at the bottom of `0001`.
