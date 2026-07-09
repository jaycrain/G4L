-- 0050: motivation_reading — the Rebuild B1 "What is Your Why?" register (Greg's Gated Assets V4 / RB-1). A
-- Self-Determination (SDT) motivation profile for activity + diet, on a 1–7 scale. This is a PARALLEL register (like
-- idq_retake / grinta_reading are their own registers) — it is NEVER folded into the Grinta 1–5 math. B1's Control
-- contribution to Grinta comes later, from B4.
--
-- Longitudinal by design: the member retakes B1 quarterly and "the distance between snapshots is the measuring
-- stick." One row per reading, sequence_no 0 = the first (v2.4 baseline). Per RB-1 the numeric profile is STORED but
-- NOT displayed in v2.4 (a lone snapshot has no comparison; the scored display waits for Cycle 2).
--
-- responses is self-describing ({ "B1-PA1": 6, ... } code→value, 1..7) so a re-score from raw is always possible
-- (same posture as grinta_reading). scores holds the computed SDT profile
--   { "activity": { "autonomous": n, "controlled": n, "amotivation": n }, "diet": { ... } }
-- as jsonb rather than typed columns: the facet math is Greg's and may yet gain a "relative"/RAI figure (held for
-- Greg), so a flexible payload avoids a migration when that lands — same reasoning as the free-text posture in 0049.
--
-- Additive + idempotent (create-if-not-exists). RLS enabled (owner-connection bypasses; default-deny for the Data
-- API roles) — no policy, same posture as 0047/0048/0049. Applied by Jay on prod; staged-only (REBUILD), nothing on
-- prod v2.3 writes this yet.
create table if not exists motivation_reading (
  reading_id  uuid primary key default gen_random_uuid(),
  tenant_id   text not null default 'public',
  member_id   uuid not null references member_profile(member_id) on delete cascade,
  source      text not null,                 -- 'b1' (governed in config, same posture as momentum_call.type)
  sequence_no int  not null,                 -- 0 = first reading (v2.4 baseline), then 1, 2, ... (quarterly)
  taken_on    date not null default current_date,
  responses   jsonb not null,                -- { "B1-PA1": 6, ... } code→value (1..7)
  scores      jsonb not null,                -- { "activity": {autonomous,controlled,amotivation}, "diet": {...} }
  created_at  timestamptz not null default now(),
  constraint motivation_reading_unique_seq unique (member_id, source, sequence_no)
);
create index if not exists motivation_reading_member_idx on motivation_reading (member_id, taken_on desc);
alter table motivation_reading enable row level security;
