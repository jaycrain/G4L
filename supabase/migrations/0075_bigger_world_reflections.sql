-- 0075: bigger_world_reading.reflections — the member's own words from C2's Bigger World Audit.
--
-- C2 shipped in v2.5 as the RATING half of Greg's V4 asset: five 1–10 items per domain → PriorityScore → Primary /
-- Secondary / Momentum Lever. Correct, and verbatim to his prompts. What it never carried was the REFLECTION half —
-- his Q3 (what the gap actually is, plus named sub-issues), Q7 (what keeps it in place) and Q8 (one early action),
-- per domain, then the five cross-domain sorting questions. That is the difference between a rating exercise and
-- the facilitated audit he designed. Built for v3.3 because Cycle 1 is the foundation every member walks
-- (Jay, 2026-08-09).
--
-- WHY A NEW COLUMN RATHER THAN `priorities`. 0054's own comment invited this data into `priorities` ("flexible so
-- the classification can gain fields (obstacle/first-action, deferred) without a migration") and that invitation is
-- half right: the CLASSIFICATION may gain keyObstacle / firstAction there, because those are derived. But the raw
-- per-domain text is the member's own writing, and `priorities` is documented as the computed output. Putting a
-- member's sentences in a column labelled "what we calculated" is how, later, someone treats their words as ours —
-- or misses them when reasoning about what a member actually wrote. Separate column, separate meaning.
--
-- SHAPE (jsonb, nullable — every reading written before today legitimately has none):
--   {
--     "domains": {
--       "physical": { "subIssues": ["Sleep","Nutrition"], "gapNote": "...", "obstacle": "...", "earlyAction": "..." },
--       "self": {...}, "social": {...}, "outlook": {...}
--     },
--     "sort": { "costliest":"physical", "identity":"self", "readiest":"social", "ripple":"self", "focus":"self" }
--   }
-- Every field is OPTIONAL. The three open questions are skippable by design — Greg budgets this asset at fifteen
-- minutes and twelve free-text answers is not fifteen minutes, so the member sets the depth (the Independence
-- Guarantee). A skipped answer stores nothing; it is never an empty string standing in for a real one.
--
-- NULLABLE ON PURPOSE, and it is not laziness: readings from v2.5 through v3.2 have no reflections and never will.
-- A NOT NULL default of '{}' would make "answered nothing" and "was never asked" the same value, and we would lose
-- the ability to tell a member who declined from a member the question never reached.
--
-- Additive + idempotent. RLS already enabled on this table by 0054; adding a column does not change that.
-- Applied by hand in the Supabase SQL Editor (prod migrations are not automatic — see
-- docs/runbooks/rls-and-migration-drift.md).

alter table bigger_world_reading add column if not exists reflections jsonb;

comment on column bigger_world_reading.reflections is
  'C2 reflection half (V4 Q3/Q7/Q8 + cross-domain sort). The MEMBER''S OWN WORDS — not computed. Null = the reading predates the reflection half; an absent field = the member skipped that question.';
