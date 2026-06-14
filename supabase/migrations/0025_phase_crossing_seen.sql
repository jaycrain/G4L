-- 0025: One-time "you've crossed into the next R" dashboard banner. Stores the last R-crossing the
-- member has already been shown, so the banner fires once when they cross a Checkpoint into a new R.
alter table member_profile add column if not exists phase_crossing_seen text;
