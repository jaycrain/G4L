-- 0085: the Door PROFILE — relevance on a continuum, plus the temporal pattern.
--
-- WHY. Greg's R2 Science Check asks the member to rate EVERY Door's relevance to their own Fade and to place them
-- in time: which they walked through FIRST, which has the BIGGEST impact today, and which is STILL OPEN. We stored
-- a bare SET of slugs with a primary flag — no relevance, no gradation, no time. The re-audit called this three
-- missing things, not one.
--
-- HIS LATER WORDS GO FURTHER THAN HIS OWN DOCUMENTS (email, 2026-08-08, unprompted):
--
--   "IT ISN'T BINARY EITHER. THERE ISN'T A SINGULAR DOOR BUT RATHER A CONTINUUM ON EACH ONE. RETAINING A
--    CONTINUOUS SCALE IS ALWAYS A GOAL IN RESEARCH INSTEAD OF CATEGORIZING SINCE IT RETAINS THE RANGE AND THE FULL
--    COMPLEXITY … A PROFILE OF ISSUES INSTEAD OF A SINGULAR ONE."
--
-- So `relevance` is 1–10, not his documents' original 1–3. A continuum can always be collapsed for display; a
-- 3-point scale cannot be un-collapsed later. 1–10 also matches the Bigger World Audit, our most recent
-- continuous instrument, so a member meets one rating vocabulary rather than two.
--
-- STILL_OPEN IS THE LOAD-BEARING ONE. Greg: "A door that is still open is the active Fade — the one R3's spark
-- will need to address." A Door closed years ago and a Door someone is walking through this week mean completely
-- different things, and the product could not tell them apart. That is the single most useful fact in this
-- migration and the reason it is worth the columns.
--
-- ALL NULLABLE, AND THAT IS THE DESIGN. Every existing member has a Door set and none of this, so an absent value
-- means "not asked yet", never "not relevant". Nothing may render a null as a zero, and no surface may compute a
-- completeness percentage over these — that would turn an invitation into a chore and a profile into a score.
--
-- NOT ENFORCED: that only one Door is `opened_first` or `biggest_impact`. A member may genuinely say two things
-- arrived together, and a database constraint would make the product argue with them about their own life. If a
-- surface needs a single one, it picks — it does not forbid.
--
-- Additive + idempotent.

alter table member_door add column if not exists relevance      int;
alter table member_door add column if not exists opened_first   boolean;
alter table member_door add column if not exists biggest_impact boolean;
alter table member_door add column if not exists still_open     boolean;
alter table member_door add column if not exists noted_at       timestamptz;

-- A rating outside 1–10 is not a rating; refuse it at the boundary rather than letting a surface decide what a 0
-- or a 47 means. NULL stays valid and means "not asked".
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'member_door_relevance_range') then
    alter table member_door add constraint member_door_relevance_range
      check (relevance is null or (relevance between 1 and 10));
  end if;
end $$;

-- The active Fade is the query this exists to serve, so it gets the index.
create index if not exists member_door_still_open_idx on member_door (member_id) where still_open;
