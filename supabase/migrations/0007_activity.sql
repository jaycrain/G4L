-- 0007: activity integration (Strava first). Normalized, provider-agnostic.
-- OAuth token columns are deliberately deferred to Path B (auth + encryption land first);
-- for now a connection row just records that a provider is linked.
create table if not exists activity_connection (
  member_id uuid not null references member_profile(member_id) on delete cascade,
  provider text not null,
  status text not null default 'connected', -- connected | disconnected
  athlete_name text,
  connected_at timestamptz not null default now(),
  primary key (member_id, provider)
);

create table if not exists activity_event (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references member_profile(member_id) on delete cascade,
  provider text not null default 'strava',
  external_id text not null,
  activity_type text not null,          -- ride, run, walk, hike, swim, workout, other
  name text,
  started_at timestamptz not null,
  distance_m double precision,          -- meters (null for non-distance activities)
  moving_time_s integer,                -- seconds
  created_at timestamptz not null default now(),
  unique (provider, external_id)
);
create index if not exists activity_event_member_idx on activity_event (member_id, started_at desc);
