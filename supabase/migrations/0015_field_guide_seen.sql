-- 0015: Field Guide "seen" — once-per-MEMBER (not per-device), so the orientation overlay
-- auto-opens exactly once across all a member's devices. (member_profile already has RLS.)
alter table member_profile add column if not exists field_guide_seen_at timestamptz;
