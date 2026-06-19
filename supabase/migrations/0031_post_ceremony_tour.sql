-- 0031: Post-Ceremony Tour — a once-per-member flag, mirroring threshold_crossed_at. Server-stamped
-- when the member finishes OR skips the guided tour that hands off from the Threshold. Null = not toured
-- → the tour fires on the first post-Threshold dashboard landing. (Re-runnable from the Field Guide.)
alter table member_profile add column if not exists tour_completed_at timestamptz;
