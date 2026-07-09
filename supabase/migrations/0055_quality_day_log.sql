-- 0055: quality_day_log — the Reclaim C3 "Quality Days" daily self-monitoring log. For one week the member logs, once
-- a day: a Quality-Day score (1–10), which of their Quality-Day elements were present (labels from their own profile),
-- and two short reflections (most valuable / most missing). One row per (member, day) — a daily check-in, upserted.
--
-- RC-4 (Greg): Quality-Day history is retained + retrievable across cycles — the member can ask "show me my past
-- scores." The QD Profile itself (the tiered definition) rides coaching_plan (phase 'reclaim', kind
-- 'quality_day_profile'); THIS table holds the daily entries (queryable by date for the week review + the score trend).
--
-- present is a jsonb array of element labels. Additive + idempotent. RLS enabled (owner-connection bypasses;
-- default-deny for the Data API roles) — no policy, same posture as 0049–0054. Applied by Jay on prod; staged-only
-- (RECLAIM), nothing on prod v2.4 writes this yet.
create table if not exists quality_day_log (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text not null default 'public',
  member_id     uuid not null references member_profile(member_id) on delete cascade,
  logged_on     date not null default current_date,
  score         int  not null,                 -- 1..10 (governed at the caller)
  present       jsonb not null default '[]',   -- the element labels present today (from the member's QD profile)
  most_valuable text,
  most_missing  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint quality_day_log_unique_day unique (member_id, logged_on)
);
create index if not exists quality_day_log_member_idx on quality_day_log (member_id, logged_on desc);
alter table quality_day_log enable row level security;
