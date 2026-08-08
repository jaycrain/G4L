-- 0074: w3_daily_entry — W3's monitoring week gets its own record, DELIBERATELY separate from Momentum.
--
-- THIS REVERSES A DECISION MADE IN 0072, and that is the most important thing to understand here. 0072 said:
--
--     "W3 — momentum_call holds a typed entry per day. Copying either into a general practice_mark table would
--      create a second record of the same fact, and two records of one fact drift."
--
-- That was correct on the evidence at the time. Two things changed it, both on 2026-08-08:
--
--   1. GREG, asked directly what W3's week should be: "MY VISION / SUGGESTION IS TO CREATE A SIMPLE 1 WEEK GRID —
--      SIMILAR TO THE NEW MOMENTUM ONE DEVELOPED FOR C3 … AFTER THEY LEARN THIS VOCABULARY AND PROCESS WE CAN
--      PERHAPS RE-TURN TO THE ONGOING MOMENTUM TRACKER AND INCORPORATE OTHER TRACKING. THAT WILL TAKE MORE
--      THOUGHT SO WE SHOULD FOCUS ON GETTING THROUGH CYCLE 1." The bounded learning week and the ongoing tracker
--      are different instruments; he wants them kept apart until members have learned the vocabulary.
--
--   2. JAY, the same morning: Momentum "may be a relic … I'd created it so there was SOME daily interaction for a
--      member to have. I believe we've replaced that notion with much more sophisticated and valuable daily
--      interactions." Momentum is being demoted from the daily surface to a cross-cycle long view. Building W3's
--      week on top of it would mean building onto something already moving.
--
-- AND — the reason 0072's instinct still deserves respect — momentum_call CANNOT hold this anyway. Greg's tracker
-- is SEVEN fields (his Engineering Memo, W3-30): the day, what went well, what didn't, WHICH NAMED TRIGGER fired,
-- what the old voice said, whether they used their prepared response, and a free reflection. momentum_call is a
-- typed call with a note. Five of the seven have nowhere to go.
--
-- THE DUPLICATION RISK IS REAL AND ACCEPTED, not overlooked. During W3 week a member could log a good call in
-- Momentum AND record one here. They are different acts — an ongoing log entry versus a bounded self-monitoring
-- observation tied to a named trigger — and Greg wants exactly that separation for Cycle 1. It resolves when
-- Momentum becomes the long view. If it starts causing confusion before then, that is a signal to accelerate the
-- Momentum move, NOT to merge these back together.
--
-- NAMING: Greg's field is "smart_choices"; ours is good_calls, because "Good Call" is the live member-facing term
-- and he conceded the word rather than intended a change ("YOU MADE A 'GOOD CALL' IN CATCHING THE FACT THAT I
-- USED A DIFFERENT WORD"). His name is kept in the column comments so the mapping to his spec stays traceable.
--
-- NO TARGET COLUMN ANYWHERE, on purpose. W3 has no adherence measure — no target, no completion percentage, no
-- "perfect week" framing appears anywhere in the asset. A count column is how that requirement gets quietly
-- violated six months from now, so there isn't one.
--
-- Additive + idempotent. RLS enabled, no policy — owner-connection bypasses, default-deny for the Data API roles
-- (same posture as 0049–0055, 0072).

create table if not exists w3_daily_entry (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    text not null default 'public',
  member_id    uuid not null references member_profile(member_id) on delete cascade,
  entry_date   date not null default current_date,
  -- Greg: smart_choices. What the member noticed went well. Free text, their words.
  good_calls   text,
  -- Greg: false_starts. Logged the SAME WAY as good_calls, as data not verdicts — identical UI weight, no
  -- red/green. Same type, same nullability, deliberately no ordering that implies one is the bad column.
  false_starts text,
  -- Greg: trigger_fired — "which named trigger, or 'new'". References practice_commitment.slot for this member's
  -- w3_logging rows (their own trigger text, saved at W3 close). Free text rather than an FK so 'new' — and a
  -- trigger they name mid-week that was never in the protocol — are both expressible.
  trigger_slot text,
  -- Greg: disinformation_campaign — what the old voice said. Optional. Ties the week back to W1's audit.
  old_voice    text,
  -- Greg: recovery_used — did they use the response they prepared. Optional, and NULL means "didn't say",
  -- which is different from false. Three states, so nullable boolean rather than a default.
  recovery_used boolean,
  -- Greg: member_reflection. Optional. Anything they want to keep from the day.
  reflection   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One entry per member per day. Editing today's entry updates it; there is no second row for the same date, so
-- the grid can never show a day as both marked and not.
create unique index if not exists w3_daily_entry_member_day on w3_daily_entry (member_id, entry_date);

-- The week reads a 7-day window ending today, per member.
create index if not exists w3_daily_entry_member_date_idx on w3_daily_entry (member_id, entry_date desc);

alter table w3_daily_entry enable row level security;
