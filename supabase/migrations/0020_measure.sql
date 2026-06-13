-- 0020: Measures — a number a member watches move over time (weight, weekly miles, resting HR,
-- dollars saved). A measure can attach to a Reclaim item so it renders beside it; it shows movement
-- from a starting value toward a target. The Member Agent can create a measure and log readings, and
-- reads the history to reflect on real movement (never a verdict, never clinical — governance posture).
-- Measures DO NOT touch the ID Score (frozen) or the GRINTA! Index; they are their own surface.

create table if not exists measure (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references member_profile(member_id) on delete cascade,
  reclaim_item_id uuid references reclaim_item(id) on delete set null,  -- optional link to a goal
  label           text not null,                                         -- "Weight"
  unit            text not null default '',                              -- "lbs", "mi", "bpm"
  direction       text not null default 'down' check (direction in ('down','up')), -- down = lower is better
  start_value     numeric,                                               -- baseline; falls back to first reading
  target_value    numeric,                                               -- goal (nullable)
  created_at      timestamptz not null default now(),
  archived_at     timestamptz
);
create index if not exists measure_member_idx on measure (member_id, created_at);
alter table measure enable row level security;

create table if not exists measure_reading (
  id          uuid primary key default gen_random_uuid(),
  measure_id  uuid not null references measure(id) on delete cascade,
  member_id   uuid not null references member_profile(member_id) on delete cascade,
  value       numeric not null,
  noted_on    date not null default current_date,   -- the day this reading is for
  created_at  timestamptz not null default now()
);
-- one reading per day per measure — re-logging the same day updates it (upsert)
create unique index if not exists measure_reading_day_uniq on measure_reading (measure_id, noted_on);
create index if not exists measure_reading_measure_idx on measure_reading (measure_id, noted_on);
alter table measure_reading enable row level security;
