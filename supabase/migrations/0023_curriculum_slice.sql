-- 0023: The curriculum slice's member state (Give-Back Model v0.4). The Session engine writes here;
-- the curriculum/badges themselves are registry DATA in code (lib/curriculum), not DB rows. Member
-- data behind the wall from day one — RLS on every table (app connects as owner, bypasses RLS; the
-- Data API stays default-denied until the multi-tenant switch-on, under senior review).

-- Per-Session progress: current lit step, saved answers, status.
create table if not exists session_progress (
  member_id    uuid not null references member_profile(member_id) on delete cascade,
  session_id   text not null,                       -- registry id, e.g. RCN-EXC
  current_step int  not null default 1,
  answers      jsonb not null default '{}'::jsonb,  -- { "1": "…", "2": "…" } keyed by step n
  status       text not null default 'in_progress' check (status in ('locked','in_progress','closed')),
  updated_at   timestamptz not null default now(),
  closed_at    timestamptz,
  primary key (member_id, session_id)
);
alter table session_progress enable row level security;

-- Facets — the reclaimed identities for the identity strip (multiple, self-identified; the onboarding
-- identity seeds facet #1, a Session close appends more).
create table if not exists facet (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references member_profile(member_id) on delete cascade,
  text           text not null,
  source_session text,                              -- which Session close produced it (null = onboarding seed)
  sort_order     int  not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists facet_member_idx on facet (member_id, sort_order);
alter table facet enable row level security;

-- Earned badges (the passport). Badge definitions live in the registry; this records what's earned.
create table if not exists badge_earned (
  member_id  uuid not null references member_profile(member_id) on delete cascade,
  badge_id   text not null,                         -- registry badge id
  earned_at  timestamptz not null default now(),
  primary key (member_id, badge_id)
);
alter table badge_earned enable row level security;

-- Phase gates — the firm-gate state (reconnect_core_complete, reconnect_checkpoint_passed,
-- rewire_unlocked, …). Presence of a row = that gate is set.
create table if not exists phase_gate (
  member_id  uuid not null references member_profile(member_id) on delete cascade,
  gate       text not null,
  set_at     timestamptz not null default now(),
  primary key (member_id, gate)
);
alter table phase_gate enable row level security;
