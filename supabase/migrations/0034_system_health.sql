-- 0034: Operator health log. One row per named check (e.g. 'ai'), holding the last observed status.
-- The cron (/api/cron/ai-health) upserts this every run; /admin reads it (no token cost on page load);
-- transition detection (ok <-> down) drives the alert email. Not member data — operational only.
create table if not exists system_health (
  check_name text primary key,
  status     text not null,                 -- ok | usage_limit | auth | overloaded | down
  detail     text,
  latency_ms int,
  checked_at timestamptz not null default now()
);
