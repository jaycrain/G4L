-- ============================================================================
-- G4L Platform — Migration 0002: asset completions
-- The asset engine records each gated-asset completion (with its variant + content
-- version + structured outputs) and emits telemetry to asset_event (already in 0001).
-- Assets themselves are versioned CONTENT delivered by a generic engine — never bespoke
-- screens (CLAUDE.md principle 1). See docs/CONTRACTS.md §5, §7.
-- Multi-tenant: tenant_id present, RLS dormant (per 0001).
-- ============================================================================

create table asset_completion (
  completion_id   uuid primary key default gen_random_uuid(),
  tenant_id       text not null default 'public',
  member_id       uuid not null references member_profile(member_id),
  cycle_indicator int  not null default 1,
  asset_code      text not null references atlas_asset(code),
  variant         text,                 -- 'a' | 'b' for variant assets (Reconnect A/B); else null
  asset_version   text not null,        -- the content version delivered (versioned content)
  completed_at    timestamptz not null default now(),
  outputs         jsonb not null default '{}'::jsonb,  -- structured asset outputs
  reflection      text,                 -- member's closing reflection, if captured
  constraint asset_completion_unique unique (member_id, cycle_indicator, asset_code),
  constraint asset_completion_variant_chk check (variant is null or variant in ('a','b'))
);
create index asset_completion_member_idx on asset_completion (member_id, completed_at desc);
create index asset_completion_asset_idx  on asset_completion (asset_code);
