-- 0057: member-logged movement. Activities the member does OUTSIDE any connected device — entered on the Movement
-- page, or told to the Companion (source distinguishes which). Merges with synced activity (activity_event) via the
-- Movement adapter's blendTimeline, tagged 'logged' (bullseye) vs 'synced' (teal). Governance (YY): interpreted
-- against who they're reclaiming, never a bare number. Cascades on member delete (member-owned data).
create table if not exists movement_log (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text not null default 'public',
  member_id     uuid not null references member_profile(member_id) on delete cascade,
  source        text not null default 'self' check (source in ('self', 'companion')),  -- who entered it
  activity_type text not null,                                                          -- walk|ride|run|hike|swim|workout|other
  note          text,                                                                   -- the member's own words, optional
  occurred_on   date not null default current_date,                                     -- the day it happened (member picks; defaults today)
  created_at    timestamptz not null default now()
);
create index if not exists movement_log_member_idx on movement_log (member_id, occurred_on desc, created_at desc);

-- RLS: default-deny for the Data API (anon/PostgREST) roles — the app's table-OWNER connection bypasses it, and there
-- are no policies, so this never affects the app. Same posture as every member-scoped table since the 0039 sweep.
alter table movement_log enable row level security;
