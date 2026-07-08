-- 0048: practice_week — the reusable practice-week scaffold (Decision MM R4). One row per (member, kind): a bounded
-- daily-practice window opened when a Rewire session completes. The Companion surfaces the day's practice on the hero
-- (the rail — NO net-new surface). W2's payload is the saved image; W3's good-call/false-start logging (the Momentum
-- slice) plugs into the SAME window later. The window is DERIVED (started_at + N days) — no per-day state — and it is
-- a productive-default nudge, never a gate (R1). Most-recent started_at wins when two are active.
--
-- `kind` is FREE TEXT (governed in config, not a DB check — same posture as keeper_type in 0046): 'w2_image' now,
-- 'w3_logging' later. Additive + idempotent. RLS enabled (owner-connection bypasses; default-deny for the Data API
-- roles), same posture as 0013/0047 — no policy. Applied by Jay on prod; staged-only (REWIRE), nothing on prod v1
-- writes it.
create table if not exists practice_week (
  tenant_id  text not null default 'public',
  member_id  uuid not null references member_profile(member_id) on delete cascade,
  kind       text not null,                 -- 'w2_image' | 'w3_logging' (governed in config, not a DB check)
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (member_id, kind)
);
create index if not exists practice_week_member_idx on practice_week (member_id, started_at desc);
alter table practice_week enable row level security;
