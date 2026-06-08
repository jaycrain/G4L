-- 0004: member avatar. Optional photo URL; null → the UI shows initials.
-- User-editable later; for now set directly (e.g. demo members, or a future upload flow).
alter table member_profile add column if not exists avatar_url text;
