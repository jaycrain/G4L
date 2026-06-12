-- 0018: The Threshold ceremony — a once-per-member, cross-device first-arrival flag.
-- Mirrors field_guide_seen_at: server-stamped when the member clips in (completes the ceremony).
-- Null = not yet crossed → the Threshold fires on the next dashboard arrival.
alter table member_profile add column if not exists threshold_crossed_at timestamptz;
