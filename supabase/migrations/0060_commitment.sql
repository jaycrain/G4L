-- 0060: first-class member COMMITMENTS — the durable, member-owned movement + eating changes the member is working on.
-- Supersedes the ephemeral "B3 coaching_plan as a session artifact" (which was a best-effort, swallowed write that
-- could vanish — Jay's walk: a completed pilot's two changes were gone from every surface). Commitments are member-set
-- and editable (propose→confirm→commit, Decision L), ONE active per domain, releasable (kept as history, never a hard
-- delete — same posture as reclaim "No Longer Central"). Momentum calls tag to these; the Companion reflects
-- follow-through (normalize, NEVER praise) and notices lapses (curiosity, never scold). Cascades on member delete.
create table if not exists commitment (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null default 'public',
  member_id   uuid not null references member_profile(member_id) on delete cascade,
  domain      text not null check (domain in ('activity', 'diet')),                     -- movement | eating (CallDomain vocab)
  text        text not null,                                                            -- the change, in the member's own words
  status      text not null default 'active' check (status in ('active', 'released')),  -- released = set aside, kept as history
  source      text not null default 'self' check (source in ('self', 'b3', 'companion')), -- where it was named
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- At most ONE active commitment per (member, domain): setting a new one releases the prior (enforced in the store).
create unique index if not exists commitment_active_domain_idx on commitment (member_id, domain) where status = 'active';
create index if not exists commitment_member_idx on commitment (member_id, status, updated_at desc);

-- RLS: default-deny for the Data API (anon/PostgREST) roles — the app's table-OWNER connection bypasses it, and there
-- are no policies, so this never affects the app. Same posture as every member-scoped table since the 0039 sweep.
alter table commitment enable row level security;
