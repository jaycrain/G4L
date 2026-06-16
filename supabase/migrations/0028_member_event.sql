-- 0028: Experience telemetry — an append-only event log of how a member actually moves through the
-- product. The implementation-outcome measures from CLAUDE.md (asset started/completed, time-on-asset,
-- drop-off point) plus surface usage (which panels they open). Internal QI: it powers the operator
-- console AND is summarized into both agents' context so the companion can notice ("you started
-- Visualization twice — want to pick it back up?") and the Founder Agent can draft from real experience.
-- Member data behind the wall — RLS on (app connects as owner, bypasses RLS; Data API default-denied).
create table if not exists member_event (
  member_id  uuid not null references member_profile(member_id) on delete cascade,
  kind       text not null,        -- session_open | session_step | session_close | checkpoint_open |
                                    -- checkpoint_cross | beat_serve | beat_close | daily_beat_view |
                                    -- idq_start | idq_complete | page_view
  surface    text,                 -- the panel/route: dashboard | playbook | journey | field_guide | session | …
  ref        text,                 -- the subject id (session_id, checkpoint id, beat_id, …) when applicable
  step       int,                  -- the step reached (session_step) — drives furthest-step / drop-off
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  id         uuid primary key default gen_random_uuid()
);
create index if not exists member_event_member_idx on member_event (member_id, created_at);
create index if not exists member_event_kind_idx   on member_event (member_id, kind);
alter table member_event enable row level security;
