-- 0065: keep the health CHECKS, not just the latest one.
--
-- `system_health` (0034) is keyed on check_name and UPSERTED, so every probe erases the one before it. That
-- answers "is the Companion up right now" and nothing else. The operator question that actually matters is
-- "has it been flaky this week" — and we were throwing away the only data that could answer it, every 15
-- minutes, forever.
--
-- Append-only. `system_health` stays exactly as it is: it remains the cheap "right now" read, and nothing
-- that queries it has to change.
--
-- VOLUME: the probe runs every 15 minutes → ~96 rows/day/check → ~35k rows/year. Trivial, but pruned at
-- 90 days anyway on write, because an operator log nobody prunes is a table someone finds at 40M rows.

create table if not exists system_health_event (
  id         bigserial primary key,
  check_name text not null,
  status     text not null,                 -- ok | usage_limit | auth | overloaded | down
  detail     text,
  latency_ms int,
  checked_at timestamptz not null default now()
);

-- The only query shapes: "recent history for one check" and "prune the old". Both are covered by this.
create index if not exists system_health_event_idx on system_health_event (check_name, checked_at desc);

alter table system_health_event enable row level security;
-- No policies, matching every other operator table: the owner connection bypasses RLS and nothing
-- member-facing reads this. Enabling it keeps the "RLS on by default" sweep (0039/0042) honest.
