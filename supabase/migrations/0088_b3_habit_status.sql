-- 0088: b3_daily_entry gains Greg's TWO HABIT STATUSES — the last two fields of his daily worksheet.
--
-- His "ReBuild B3 - Daily Monitoring Log" (Gated Assets V4, SOURCE) opens with two questions before any of the
-- free text:
--
--     Physical activity habit    Completed / Partial / Missed
--     Dietary habit              Completed / Partial / Missed
--
-- and his daily check-in script asks them first, in those words: "How did you do with your physical activity habit
-- today: completed, partial, or missed?"
--
-- 0084 built the six free-text fields and stopped there, so B3's week recorded what a member NOTICED and never what
-- she DID. The grid meanwhile records a tick — done or not — from practice_mark.
--
-- PARTIAL IS THE WHOLE REASON THIS MATTERS, and it is why a boolean cannot stand in. Greg's own tone spec for this
-- phase says to reinforce that "backup versions still count" and to avoid "all-or-nothing interpretations" and
-- "treating a miss as failure". A two-state tick makes the all-or-nothing reading the only one available: a member
-- who planned a 20-minute walk and did 10 has to choose between claiming a day she did not have and recording a
-- failure she did not have either. Partial is the honest answer, and it is the one his design asks for.
--
-- THREE STATES, PLUS NULL. 'completed' | 'partial' | 'missed', nullable — and NULL is a fourth, real answer:
-- "didn't say". Same rule as w3_daily_entry.recovery_used, and for the same reason: defaulting to 'missed' would
-- record a failure the member never reported. A day where she talks about how she felt and never mentions the
-- habit is a valid day.
--
-- A CHECK CONSTRAINT, not an enum type. The values are Greg's vocabulary and could change with his next revision;
-- a check is one ALTER away, where a Postgres enum is a migration with a type rewrite. Same call as elsewhere here.
--
-- NO SCORING, NO COUNT, NO TARGET — the standing rule for every practice week in this product. Nothing derives a
-- completion rate from these, and there is deliberately no column to hang one on. 'partial' exists to be recorded
-- and reflected, never to be averaged into a number that turns a week into a grade.
--
-- Additive + idempotent. RLS is already enabled on the table by 0084; this adds columns only.

alter table b3_daily_entry
  add column if not exists activity_status text,
  add column if not exists diet_status     text;

-- Greg's three values, and nothing else. NULL stays legal on purpose — see above.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'b3_daily_entry_activity_status_chk') then
    alter table b3_daily_entry
      add constraint b3_daily_entry_activity_status_chk
      check (activity_status is null or activity_status in ('completed', 'partial', 'missed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'b3_daily_entry_diet_status_chk') then
    alter table b3_daily_entry
      add constraint b3_daily_entry_diet_status_chk
      check (diet_status is null or diet_status in ('completed', 'partial', 'missed'));
  end if;
end $$;

comment on column b3_daily_entry.activity_status is
  'Greg B3 daily worksheet: "Physical activity habit — Completed / Partial / Missed". NULL = didn''t say.';
comment on column b3_daily_entry.diet_status is
  'Greg B3 daily worksheet: "Dietary habit — Completed / Partial / Missed". NULL = didn''t say.';
