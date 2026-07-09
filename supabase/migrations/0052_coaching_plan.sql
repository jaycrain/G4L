-- 0052: coaching_plan — the member-owned plan artifact behind the Companion COACHING mode (Decision PP / RB-4).
-- First used by Rebuild B3 (the Lifestyle Pilot: one small activity change + one small diet change). GENERIC by
-- design: `phase` + a flexible jsonb `payload` so Reclaim (quality-days) and Cycle 2 (deepening) reuse the SAME table
-- rather than forking a per-Phase table (the fork PP warns against). The per-Phase SHAPE lives in the app layer (a TS
-- payload type + the coach completeness contract + the practice-week payload), never in the schema.
--
-- Most-recent-active-wins: a member may re-run the pilot; the newest 'active' row leads. CRUD-able from the rail
-- (Decision L). Momentum calls reference the plan by carrying their own domain tag (0049) — the plan needs no
-- Rebuild-specific columns.
--
-- Additive + idempotent. RLS enabled (owner-connection bypasses; default-deny for the Data API roles) — no policy,
-- same posture as 0047–0051. Applied by Jay on prod; staged-only (REBUILD), nothing on prod v2.3 writes this yet.
create table if not exists coaching_plan (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null default 'public',
  member_id   uuid not null references member_profile(member_id) on delete cascade,
  phase       text not null,                    -- 'rebuild' | 'reclaim' | 'cycle2' (governed in config)
  payload     jsonb not null,                   -- rebuild: { activityChange, dietChange } · other phases: their own shape
  status      text not null default 'active',   -- 'active' | 'complete' | 'abandoned'
  week_start  date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists coaching_plan_member_idx on coaching_plan (member_id, phase, created_at desc);
alter table coaching_plan enable row level security;
