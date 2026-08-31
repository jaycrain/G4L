-- 0091: what each Door actually DID to her — her own words, tagged by Door.
--
-- WHY. R2 stored a rating and a temporal flag per Door (0085) and her narrative in ONE undifferentiated place. So
-- six downstream Sessions could tell WHICH Doors a member holds and roughly what she said, but never what she said
-- ABOUT A GIVEN DOOR. Greg's Companion + Engineering Memos ask for exactly that, per Door:
--
--   R2-31: "Capture the rating, tagged by door / Capture the Member's language about what the door meant in their
--           life"  → stored record has {door, rating, member_language} per explored door
--   R2-33: "After the Member rates each door, the Companion elicits any reflection that comes with the rating —
--           what the door looked like in their life, when it happened, whether it is still open."
--
-- WHAT CHANGED TO MAKE THIS WORTH BUILDING (Jay, 2026-08-30, from Donna's live walk): R2 excavated ONE Door — the
-- one she said weighs most — and the other five got a rating and nothing else. His ruling: "we should walk through
-- every door. It is potentially the most valuable information we can learn about a Member. I can imagine that
-- driving what we do in Cycle 2."
--
-- CYCLE 2 IS THE POINT, and Greg wrote the same thing first: "a member coming back to ReConnect on a second or
-- third cycle will name different doors, or the same doors with different weight, because the Fade has different
-- dimensions each time through." That comparison is only possible if the FIRST pass stored per-Door meaning. It
-- did not. This is the column that makes the second cycle legible.
--
-- ABSENT IS NOT ZERO — same rule as 0085, and it matters more here. Every existing member has Doors and none of
-- this. A null member_language means "not walked yet", never "she had nothing to say about it". No surface may
-- render a null as empty commentary, and nothing may count how many Doors have been walked as a completeness
-- score: Greg's own off-target list forbids treating skipped doors as failure.
--
-- HER WORDS, VERBATIM. This column holds what SHE typed, never a model summary of it (their-own-words-back). A
-- paraphrase here would be the product remembering a version of her life she did not say.
--
-- Additive + idempotent.

alter table member_door add column if not exists member_language text;
alter table member_door add column if not exists excavated_at    timestamptz;

-- The resume query: which of her Doors have not been walked yet. R2 is resumable by design — six excavations is
-- more than one sitting, and Greg caps a sitting at 10–15 minutes — so "where did she stop" is asked on every
-- re-entry and deserves the index.
create index if not exists member_door_unexcavated_idx
  on member_door (member_id) where excavated_at is null;
