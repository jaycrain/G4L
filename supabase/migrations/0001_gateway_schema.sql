-- ============================================================================
-- G4L Platform — Migration 0001: Gateway schema
-- ----------------------------------------------------------------------------
-- Scope: the Gateway slice — onboarding -> IDQ -> ID Score -> Reclaim List + Door.
-- This is the foundation the rest of the charter MVP (asset engine, dosing,
-- dashboard-lite) builds on, because it produces the frozen data contracts
-- (Reclaim List of 7, the Door, the baseline ID Score).
--
-- Every value here is justified in docs/CONTRACTS.md. Section refs are inline.
-- Source specs: Member Agent Tech Spec v1.1 §3.3/§3.4 (corrected to the May 2026
-- cascade), Authoring Brief v1.3, AI Governance Framework v2.0, Decision Log v1.3.
--
-- Multi-tenant note (CONTRACTS §10): member-scoped tables carry tenant_id DEFAULT
-- 'public' so row-level isolation can be switched on later. RLS itself is left
-- DORMANT in this migration (no corporate features at launch) — see the RLS TODO
-- at the bottom. Single public tenant only for the charter MVP.
-- ============================================================================

-- gen_random_uuid() is built into Postgres core since v13 — no extension needed.

-- updated_at touch trigger -----------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- REFERENCE / CONFIG TABLES (seeded in supabase/seed/0001_reference_data.sql)
-- ============================================================================

-- The 8 Doors — CONTRACTS §3 (locked to the pitch deck). Reference table rather
-- than an enum so descriptors are editable config, not code.
create table door (
  slug         text primary key,        -- e.g. 'career_cliff'
  display_name text not null,           -- e.g. 'The Career Cliff'
  descriptor   text not null,
  sort_order   int  not null
);

-- The 4 IDQ dimensions — CONTRACTS §1.
create table idq_dimension (
  key        text primary key,          -- 'physical' | 'self' | 'social' | 'outlook'
  label      text not null,             -- 'Physical' | 'Self' | 'Social' | 'Outlook'
  anchoring  text not null,             -- the theory anchor
  item_count int  not null default 6,
  sort_order int  not null
);

-- The Atlas — CONTRACTS §5. Seeded with the 12 gated assets (full Atlas = 28).
-- Foundation for the asset engine; assets are versioned, swappable content.
create table atlas_asset (
  code            text primary key,     -- 'R-1', 'W-3', ...
  name            text not null,
  r_group         text not null check (r_group in ('Reconnect','Rewire','Rebuild','Reclaim')),
  layer           text,                 -- 'Recognition' | 'Excavation' | 'Spark' | ...
  is_gated        boolean not null default false,
  supports_variants boolean not null default false,  -- Reconnect A/B test
  sort_order      int not null
);

-- ============================================================================
-- MEMBER-SCOPED TABLES
-- ============================================================================

-- Layer 3 — Member Profile. Member Agent Tech Spec v1.1 §3.3, corrected:
-- reclaim_list is the frozen 7-item contract (CONTRACTS §6); no 'phase' column —
-- the dashboard shows "current focus" (CONTRACTS §4).
create table member_profile (
  member_id            uuid primary key default gen_random_uuid(),
  tenant_id            text not null default 'public',          -- CONTRACTS §10
  hubspot_contact_id   text unique,                             -- CRM spine FK (nullable pre-sync)
  display_name         text not null,
  email                text not null,
  age                  int,
  location_city        text,
  location_state       text,

  -- Reconnect / onboarding outputs (CONTRACTS §6 — frozen)
  named_door           text references door(slug),
  identity_noun        text,                                    -- e.g. 'ATHLETE'
  identity_paragraph   text,                                    -- Member Agent onboarding synthesis
  intake_athletic_past text,                                    -- onboarding chapter 1
  intake_gap           text,                                    -- onboarding chapter 2
  intake_right_now     text,                                    -- onboarding chapter 3
  reclaim_list         jsonb,                                   -- exactly 7 items once set

  membership_tier      text not null default 'foundation'
                         check (membership_tier in ('foundation','work','direct')),
  cycle_indicator      int not null default 1,

  -- Consent / governance (AI Governance Framework v2.0; CONTRACTS §8)
  ai_consent_granted_at timestamptz,                            -- null => Independence-Guarantee degraded mode
  sms_opt_in           boolean not null default false,

  active               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Reclaim List is either unset or exactly 7 items (frozen contract)
  constraint reclaim_list_is_seven
    check (reclaim_list is null or jsonb_array_length(reclaim_list) = 7)
);

create index member_profile_tenant_idx        on member_profile (tenant_id) where active;
create index member_profile_hubspot_idx        on member_profile (hubspot_contact_id);
create unique index member_profile_email_active on member_profile (tenant_id, lower(email)) where active;

create trigger member_profile_touch
  before update on member_profile
  for each row execute function set_updated_at();

-- Layer 3 audit — append-only record of profile changes (spec §3.3).
create table member_profile_audit (
  audit_id    uuid primary key default gen_random_uuid(),
  tenant_id   text not null default 'public',
  member_id   uuid not null references member_profile(member_id),
  field       text not null,
  old_value   jsonb,
  new_value   jsonb,
  changed_by  text not null,            -- 'member_agent' | 'member' | 'system'
  occurred_at timestamptz not null default now()
);
create index member_profile_audit_member_idx on member_profile_audit (member_id, occurred_at desc);

-- Layer 4 — IDQ retakes. Member Agent Tech Spec v1.1 §3.4, corrected to the
-- May 2026 cascade scoring (CONTRACTS §1–2):
--   * dimensions Physical/Self/Social/Outlook, 6 items each, Likert 1–5
--   * per-dimension raw = 6..30 ; id_score_raw = 24..120
--   * id_score = normalized 0..100 = round((raw / 120) * 100, 2)
--   * NO bands — movement = direction + signed delta + number
create table idq_retake (
  retake_id           uuid primary key default gen_random_uuid(),
  tenant_id           text not null default 'public',
  member_id           uuid not null references member_profile(member_id),
  cycle_indicator     int  not null,
  sequence_no         int  not null,            -- 0 = baseline, then 1,2,3...
  taken_at            timestamptz not null default now(),

  responses           jsonb not null,           -- 24 items, Likert 1–5 (validated app-side)

  -- per-dimension raw sums (6 items x 1..5)
  physical_score      int not null check (physical_score between 6 and 30),
  self_score          int not null check (self_score     between 6 and 30),
  social_score        int not null check (social_score   between 6 and 30),
  outlook_score       int not null check (outlook_score  between 6 and 30),

  id_score_raw        int not null check (id_score_raw between 24 and 120),
  id_score            numeric(5,2) not null check (id_score between 0 and 100),  -- normalized headline

  -- movement (bands retired — CONTRACTS §2)
  delta_from_baseline numeric(5,2),             -- null on baseline
  delta_from_previous numeric(5,2),             -- null on baseline
  direction           text check (direction in ('up','down','flat')),

  created_at          timestamptz not null default now(),
  constraint idq_retake_unique_seq unique (member_id, cycle_indicator, sequence_no),
  constraint idq_dimensions_sum_raw
    check (physical_score + self_score + social_score + outlook_score = id_score_raw)
);
create index idq_retake_member_idx on idq_retake (member_id, taken_at desc);

-- Telemetry — CONTRACTS §7. Implementation-outcome events, internal QI from day
-- one (no IRB dependency). started / completed / time-on-asset / drop-off.
create table asset_event (
  event_id      uuid primary key default gen_random_uuid(),
  tenant_id     text not null default 'public',
  member_id     uuid not null references member_profile(member_id),
  asset_code    text not null references atlas_asset(code),
  event_type    text not null check (event_type in ('started','completed','drop_off')),
  occurred_at   timestamptz not null default now(),
  time_on_asset_ms bigint,                       -- on completed/drop_off
  drop_off_point   text,                         -- on drop_off
  variant       text,                            -- for A/B-tested assets (Reconnect)
  payload       jsonb default '{}'::jsonb
);
create index asset_event_member_idx on asset_event (member_id, occurred_at desc);
create index asset_event_asset_idx  on asset_event (asset_code, event_type, occurred_at desc);

-- ============================================================================
-- RLS — DORMANT for the charter MVP (single public tenant).
-- The tenant_id columns above lay the row-level-isolation foundation now.
-- A later migration (P3, when a corporate tenant is funded) enables RLS with
-- per-table policies of the form:
--     using (tenant_id = current_setting('app.current_tenant_id', true))
-- and the agent runtime sets app.current_tenant_id at session start.
-- See Member Agent Tech Spec v2.0 §2.5. Do NOT enable here.
-- ============================================================================
