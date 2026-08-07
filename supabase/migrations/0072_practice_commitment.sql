-- 0072: practice_commitment + practice_mark + practice_week.closed_at — the practice week gets ROWS, DAYS, and an END.
--
-- WHY. A practice week opens after W2/W3/B2/B3/C3 and then does nothing: practice_week is (member, kind, started_at)
-- with the day DERIVED, so there is no per-day state to draw anything from, no target to measure against, and no way
-- for a week to finish — it expires by clock, silently. Greg (2026-08-07): "I would like to work on having the grid
-- type of tracker for W3, B3 and C3 … it would help to show progress during the week to maintain motivation." His
-- sample grid is rows (the member's committed goals, each with a target like "5 days in the week") × 7 day columns.
--
-- WHAT IS DELIBERATELY *NOT* HERE. Two of the three grid weeks ALREADY hold their per-day data:
--   · C3 — quality_day_log.present[] is the element-by-day record, and the QD profile supplies the row labels.
--   · W3 — momentum_call holds a typed entry per day.
-- Copying either into a general practice_mark table would create a second record of the same fact, and two records of
-- one fact drift (that is this morning's checkpoint bug, one day later). So the read model adapts per kind and this
-- migration adds storage ONLY where it is genuinely missing: B3's commitments + their per-day ticks, and B2's
-- noticing week, which has a written daily prompt and — until now — nowhere at all for the answer to land.
--
-- practice_commitment: the grid's rows. Target is the MEMBER's number (the B3 coach asks), not ours.
-- practice_mark:       one row per commitment per day. A commitment_id of NULL is a day-level note (B2's noticing).
-- closed_at:           lets a week END — reviewed and handed forward — instead of ageing out.
--
-- kind matches practice_week.kind, governed in config not a DB check (same posture as 0048/0049). Additive +
-- idempotent. RLS enabled, no policy — owner-connection bypasses, default-deny for the Data API roles (0049–0055).

create table if not exists practice_commitment (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null default 'public',
  member_id   uuid not null references member_profile(member_id) on delete cascade,
  kind        text not null,              -- practice_week.kind: 'b3_pilot' | 'c3_quality' | …
  slot        text not null,              -- stable per-kind key ('activity' | 'diet'), so a re-run maps to the same row
  label       text not null,              -- the member's own words: "15 minutes of functional fitness"
  target_days int,                        -- how many days THEY aimed for; null = no target (just noticing)
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint practice_commitment_unique_slot unique (member_id, kind, slot)
);
create index if not exists practice_commitment_member_idx on practice_commitment (member_id, kind, sort_order);
alter table practice_commitment enable row level security;

create table if not exists practice_mark (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text not null default 'public',
  member_id     uuid not null references member_profile(member_id) on delete cascade,
  kind          text not null,
  commitment_id uuid references practice_commitment(id) on delete cascade, -- null = a day-level note (B2 noticing)
  marked_on     date not null default current_date,
  note          text,
  source        text,                     -- 'grid' | 'companion' — the same cell, whichever way they reached it
  created_at    timestamptz not null default now()
);
-- One mark per commitment per day. Ticking twice (tap the grid, then tell the Companion) must not double-count, and
-- the partial index is what makes the day-level note (null commitment_id) able to coexist with commitment ticks.
create unique index if not exists practice_mark_unique_day
  on practice_mark (member_id, commitment_id, marked_on) where commitment_id is not null;
create unique index if not exists practice_mark_unique_note_day
  on practice_mark (member_id, kind, marked_on) where commitment_id is null;
create index if not exists practice_mark_member_idx on practice_mark (member_id, kind, marked_on desc);
alter table practice_mark enable row level security;

alter table practice_week add column if not exists closed_at timestamptz;
