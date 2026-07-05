-- 0047: grinta_reading — the longitudinal GRINTA measure (the survey grinta, NOT the activity-derived Daily
-- Call register in lib/grinta/index.ts). One row per reading: the onboarding baseline (sequence_no 0), then the
-- §2e Reconnect Checkpoint and beyond. Mirrors idq_retake's longitudinal shape, on the 1–5 strand scale.
--
-- responses is self-describing ({ "G1Q1": 5, ... } code→value) so a later reading that re-administers only some
-- strands (the Checkpoint re-reads GRIT) can recompute per-strand from the raw items and carry the other strands
-- forward. Per-strand means are nullable for exactly that reason. Movement (change_pct/direction) is vs the prior
-- reading, signed up-positive; null on the baseline (no delta on a first reading).
--
-- Additive + idempotent (create-if-not-exists). RLS enabled (owner-connection bypasses; default-deny for the Data
-- API roles) to satisfy the coverage guard — no policy, same posture as 0013/0039/0042. Applied by Jay on prod;
-- nothing on prod v1 writes this yet (staged-only).
create table if not exists grinta_reading (
  reading_id      uuid primary key default gen_random_uuid(),
  tenant_id       text not null default 'public',
  member_id       uuid not null references member_profile(member_id),
  source          text not null check (source in ('onboarding', 'checkpoint')),
  sequence_no     int  not null,                                   -- 0 = baseline, then 1, 2, ...
  taken_at        timestamptz not null default now(),

  responses       jsonb not null,                                  -- { "G1Q1": 5, ... } code→value (1..5)
  composite       numeric(4,2) not null check (composite between 1 and 5),

  -- per-strand means (1..5), one per R. Nullable: a reading may re-administer only some strands.
  reconnect_score numeric(4,2) check (reconnect_score between 1 and 5),
  rewire_score    numeric(4,2) check (rewire_score    between 1 and 5),
  rebuild_score   numeric(4,2) check (rebuild_score   between 1 and 5),
  reclaim_score   numeric(4,2) check (reclaim_score   between 1 and 5),

  -- movement vs the prior reading (signed up-positive percent). Null on the baseline.
  change_pct      numeric(6,2),
  direction       text check (direction in ('up', 'down', 'flat')),

  created_at      timestamptz not null default now(),
  constraint grinta_reading_unique_seq unique (member_id, sequence_no)
);
create index if not exists grinta_reading_member_idx on grinta_reading (member_id, taken_at desc);
alter table grinta_reading enable row level security;
