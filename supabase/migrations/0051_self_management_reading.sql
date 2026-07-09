-- 0051: self_management_reading — the Rebuild B2 "Strengths & Weaknesses" register (Greg's Gated Assets V4). A
-- 12-skill self-management assessment (activity + diet, 24 items, 4-point scale) stored as a skill profile. Its own
-- parallel register (sibling to motivation_reading / 0050) — used later by the B4 Structure check and future cycles.
--
-- Longitudinal: the member retakes B2 as an awareness tool across cycles; sequence_no 0 = the first (v2.4) read.
-- responses is self-describing ({ "B2-PA1": 3, ... } code→value, 1..4). scores holds the computed profile
--   { "activity": {...}, "diet": {...}, "perSkill": [...], "meta": {...} }
-- as jsonb rather than typed columns — the skill/meta math may evolve, so a flexible payload avoids a migration.
--
-- Additive + idempotent. RLS enabled (owner-connection bypasses; default-deny for the Data API roles) — no policy,
-- same posture as 0047–0050. Applied by Jay on prod; staged-only (REBUILD), nothing on prod v2.3 writes this yet.
create table if not exists self_management_reading (
  reading_id  uuid primary key default gen_random_uuid(),
  tenant_id   text not null default 'public',
  member_id   uuid not null references member_profile(member_id) on delete cascade,
  source      text not null,                 -- 'b2' (governed in config)
  sequence_no int  not null,                 -- 0 = first reading (v2.4), then 1, 2, ...
  taken_on    date not null default current_date,
  responses   jsonb not null,                -- { "B2-PA1": 3, ... } code→value (1..4)
  scores      jsonb not null,                -- { activity, diet, perSkill, meta }
  created_at  timestamptz not null default now(),
  constraint self_management_reading_unique_seq unique (member_id, source, sequence_no)
);
create index if not exists self_management_reading_member_idx on self_management_reading (member_id, taken_on desc);
alter table self_management_reading enable row level security;
