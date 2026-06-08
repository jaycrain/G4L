-- 0008: nudge log — what proactive nudges we've pushed, so the scheduled job can frequency-cap
-- (a cooldown per member) and avoid repeating the same message. Manual admin sends are not logged
-- here; this governs the automated path only.
create table if not exists nudge_log (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references member_profile(member_id) on delete cascade,
  kind text not null,
  text text not null,
  channel text not null default 'push',
  sent_at timestamptz not null default now()
);
create index if not exists nudge_log_member_idx on nudge_log (member_id, sent_at desc);
