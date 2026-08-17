-- 0084: b3_daily_entry — B3's monitoring week gets Greg's seven fields, the same move 0074 made for W3.
--
-- WHY B3 NEEDED THIS AND W3 ALREADY HAD IT. The re-audit (docs/greg-library/RE-AUDIT.md) found B3 recording its
-- week as a BOOLEAN TICK: rows in practice_mark, `commitment_id + marked_on`, nothing else. Greg's B3 in-app
-- summary says the member tracks "Smart Choices, False Starts, obstacles, THOUGHTS, FEELINGS, and how eating and
-- movement influence one another", and his Engineering Memo names the storage. Six of those seven had nowhere to
-- go. B3 was simply behind W3 on the same requirement, so this extends a proven shape rather than inventing one.
--
-- THE TICK STAYS. practice_mark still records that a commitment was kept on a day — that is what draws the grid,
-- and the grid is Greg's own instrument (his sample sheet is rows × seven day columns). This table holds the
-- OBSERVATION beside it, not instead of it. They answer different questions: "did the plan happen" and "what did
-- you notice". Merging them would force a member who wants to write a sentence to also assert a tick, and a
-- member who ticks to be prompted for prose.
--
-- FUEL-TO-MOVE IS ITS OWN COLUMN, and Greg is emphatic that it is INVITED, NEVER FORCED — "You don't have to find
-- a connection every day." So it is nullable and never required, and no surface may count how often it is filled.
-- It exists because the eating/movement interaction is the integrative insight B3 is built to produce.
--
-- NO TARGET, NO COUNT, NO SCORE COLUMN — same as 0074, same reason. B3's own Engineering Memo lists "presents a
-- compliance score, fitness score, or percentage" as off-target. A count column is how that gets quietly violated
-- six months from now by someone adding a "completion" readout, so there isn't one to reach for.
--
-- NAMING: Greg's field is "smart_choices"; ours is good_calls, matching w3_daily_entry and the live member-facing
-- term. His names are kept in the column comments so the mapping back to his spec stays traceable.
--
-- Additive + idempotent. RLS enabled, no policy — owner-connection bypasses, default-deny for the Data API roles
-- (same posture as 0049–0055, 0072, 0074).

create table if not exists b3_daily_entry (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     text not null default 'public',
  member_id     uuid not null references member_profile(member_id) on delete cascade,
  entry_date    date not null default current_date,
  -- Greg: smart_choices. What the member noticed went well. Free text, their words.
  good_calls    text,
  -- Greg: false_starts. Logged the SAME WAY as good_calls — identical weight, no red/green, no ordering that
  -- implies one is the bad column. "A False Start followed by a return to the protocol is a win, not a failure."
  false_starts  text,
  -- Greg: what_contributed. What made the Smart Choice easy or the False Start hard — the conditions, not a cause.
  contributed   text,
  -- Greg: obstacles. What disrupted the plan that day.
  obstacles     text,
  -- Greg: thoughts_feelings. Optional. What was going through their mind — named in his in-app summary, and the
  -- half of the week we were not capturing at all.
  thoughts      text,
  -- Greg: fuel_to_move. Did eating and movement affect each other, and how. INVITED, NEVER FORCED.
  fuel_to_move  text,
  -- Greg: member_reflection. Optional. Anything they want to keep from the day.
  reflection    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One entry per member per day. Editing today's entry updates it, so a day can never appear twice in the week.
create unique index if not exists b3_daily_entry_member_day on b3_daily_entry (member_id, entry_date);

-- The week reads a 7-day window ending today, per member.
create index if not exists b3_daily_entry_member_date_idx on b3_daily_entry (member_id, entry_date desc);

alter table b3_daily_entry enable row level security;
