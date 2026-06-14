-- 0026: The Daily Beat panel's state — which reflection a member was shown on a given day. Drives the
-- "one per day, stable on refresh, no-repeat until all 70 spent" rotation (see G4L_Daily_Beat_Build_Spec).
-- Reflection content is registry DATA in code (lib/daily-beat); this only logs the per-day pick.
-- Member data behind the wall — RLS on (app connects as owner, bypasses RLS; Data API default-denied).
create table if not exists daily_beat_log (
  member_id     uuid not null references member_profile(member_id) on delete cascade,
  shown_on      date not null,                        -- the local day this reflection was surfaced
  reflection_id text not null,                        -- registry id, e.g. RCN-EXC-01
  created_at    timestamptz not null default now(),
  primary key (member_id, shown_on)
);
alter table daily_beat_log enable row level security;
