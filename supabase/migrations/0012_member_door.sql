-- 0012: Multi-Door support. A member's Fade can trace to more than one Door (voice rewrite v1:
-- "most people walked through more than one door"). member_profile.named_door is kept as the
-- PRIMARY door (single-value reads: roster, founder one-liner); member_door holds the full set.
create table if not exists member_door (
  member_id  uuid not null references member_profile(member_id) on delete cascade,
  door_slug  text not null references door(slug),
  is_primary boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key (member_id, door_slug)
);
create index if not exists member_door_member_idx on member_door (member_id, sort_order);

-- Reclaim List: relax "exactly 7" to "at least 3" (voice rewrite v1). Existing 7-item rows
-- still satisfy the new floor. Idempotent so re-applying the migration is safe.
alter table member_profile drop constraint if exists reclaim_list_is_seven;
alter table member_profile drop constraint if exists reclaim_list_min_3;
alter table member_profile add constraint reclaim_list_min_3
  check (reclaim_list is null or jsonb_array_length(reclaim_list) >= 3);
