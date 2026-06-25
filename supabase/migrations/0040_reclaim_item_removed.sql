-- 0040: Reclaim List editing — soft-remove support.
--
-- The Companion can now remove an item from a member's Reclaim List through conversation
-- (handoff 2026-06-25). Removal is a SOFT delete, never a raw DELETE: we stamp removed_at and
-- filter removed items out of every "active items" read. The row — and its whole history (state,
-- closer_count, reclaimed_at, created_at) — is preserved and the removal is reversible (set
-- removed_at back to NULL), the same audited, recovery-first posture other member-data mutations
-- keep. "We can bring it back any time" is literally true.

alter table reclaim_item add column if not exists removed_at timestamptz;
create index if not exists reclaim_item_active_idx on reclaim_item (member_id, sort_order) where removed_at is null;
