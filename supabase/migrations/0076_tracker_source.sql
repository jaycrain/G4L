-- 0076 — WHICH ROUTE THE MEMBER TOOK.
--
-- (Not "door": in this product the Door is the life event that opened someone's Fade. Overloading it here would
-- make a reader parse the wrong noun, and the naming guard says so before review does.)
--
-- practice_mark has carried `source` ('grid' | 'companion') since 0072, written by both paths. w3_daily_entry and
-- quality_day_log — the two richest trackers — carry no such column, so for those we cannot tell a tap from a
-- conversation from a form. That mattered little while each had exactly one way in. It stops being true the moment
-- W3's grid becomes tappable (2026-08-12), which gives it two ways in and no record of which was used.
--
-- WHY IT IS WORTH STORING. Greg's W3 Engineering Memo asks the Companion to support the habit "through anchoring,
-- FRICTION REDUCTION, and streak reinforcement", and his UX requirements lead with a "Quick check-in interface —
-- low-friction daily entry". Whether members actually tap or tell is the direct measurement of that, and it is the
-- one question we cannot answer retroactively — an unrecorded route is gone.
--
-- AND WHERE THIS STOPS (Jay + CC, 2026-08-12). This records that an interaction happened and by what route. It adds
-- nothing about WHAT a member said. "Keep it in case it is useful later" is right for metadata about how the
-- product is used and wrong for member content, which the governance framework holds to minimum-necessary. The test
-- for the next column like this: is it ABOUT the interaction, or FROM it?
--
-- Nullable with no default and no backfill: rows written before today genuinely do not know their source, and
-- inventing 'companion' for them would manufacture a measurement. NULL means "we weren't recording yet" and reads
-- as exactly that.

alter table w3_daily_entry  add column if not exists source text; -- 'grid' | 'companion'
alter table quality_day_log add column if not exists source text; -- 'form'  | 'companion'
