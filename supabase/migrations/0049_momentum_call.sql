-- 0049: momentum_call — the member's logged "calls" (good_call | false_start | quiet_day) that feed the Resilience
-- Pulse (Rewire W3 · Step 3, Decisions EE/FF/MM). A call is a DISCRETE EVENT, not a daily form: a member may log
-- none, one, or SEVERAL in a day. So the PK is a surrogate id and there is NO unique-per-day constraint — multiple
-- rows per (member, logged_on) are valid; the pulse aggregates a day to its net shape at read time (M-5).
--
-- `type` and `source` are FREE TEXT governed in config (same posture as keeper_type in 0046 / kind in 0048), not DB
-- check-constraints. `domain` ships optional-and-UNUSED (v1) so behavior-domain tagging (movement vs. eating) is a
-- no-migration add later. Self-monitoring only — this NEVER feeds Grinta or the ID Score (never-merge, Decision EE).
--
-- Additive + idempotent. RLS enabled (owner-connection bypasses; default-deny for the Data API roles), same posture
-- as 0047/0048 — no policy. Applied by Jay on prod; staged-only (REWIRE), nothing on prod v1 writes it.
create table if not exists momentum_call (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  text not null default 'public',
  member_id  uuid not null references member_profile(member_id) on delete cascade,
  type       text not null,                 -- 'good_call' | 'false_start' | 'quiet_day' (governed in config)
  logged_on  date not null default current_date,
  note       text,
  domain     text,                          -- optional, UNUSED in v1 (behavior-domain tagging is a later add)
  source     text not null,                 -- 'rail' | 'momentum_page'
  created_at timestamptz not null default now()
);
create index if not exists momentum_call_member_idx on momentum_call (member_id, logged_on desc);
alter table momentum_call enable row level security;
