-- 0019: Reclaim List holds ANY goal (see docs/reclaim-anygoal.md). Add a fifth, internal category
-- 'life' for goals that don't map to an IDQ dimension (e.g. "raise $250k"). Invisible to the member;
-- it only tells the engine an item is tracked-and-witnessed (no Beat coaches it) rather than coached.
alter table reclaim_item drop constraint if exists reclaim_item_category_check;
alter table reclaim_item
  add constraint reclaim_item_category_check check (category in ('physical','self','social','outlook','life'));
