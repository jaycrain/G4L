-- 0044: Instrument administration tier (foundation for v2.2 instruments; §3.7 / Depth Arch §5, CC flag 3).
-- A config property on the asset registry ROW — the KIND_PROFILES pattern — so every instrument inherits its
-- administration mode WITHOUT per-instrument code branches. Three tiers:
--   'validated'   — IDQ / Grinta baseline / the four Checkpoints: feed a real number, so validity is load-bearing
--                   (verbatim items, explicit ratings; the conversation frames but never paraphrases an item).
--   'exploratory' — the Doors: the conversation IS the instrument, the "rating" a salience read (inferred).
--   'formative'   — the audits / weekly logs: stored-not-scored, conversational, precision not load-bearing.
-- Classification rule: does a validated score depend on these exact numbers? Yes → validated; No → the
-- conversation can carry it. FREE TEXT, deliberately NOT a DB check-constraint (the 0019/0024 migration tax):
-- the tier taxonomy is governed in the registry/config, not the schema, so a new tier never needs a migration.
-- No instruments live in onboarding (v2.1) — this only establishes the field. Additive + idempotent.
alter table atlas_asset add column if not exists administration_tier text;
comment on column atlas_asset.administration_tier is
  'validated | exploratory | formative — governed in registry/config, never a DB check-constraint';

-- The tier VALUES live in the seed (reference/config data, re-applied idempotently), so they land correctly on
-- a fresh apply (migrations run before the seed) and self-heal on every boot. The IDQ (R-1) = validated there.
