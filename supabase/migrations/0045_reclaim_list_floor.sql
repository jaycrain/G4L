-- 0045: Reclaim List floor — relax to match the v2.1 finalize floor. The Gate-1 decision lowered the hard
-- finalize floor to >= 1 (the card carries any shortfall below the ~3 soft aim; post-onboarding editing reaches
-- the ~7 aim). member_profile.reclaim_list is the denormalized copy; the DB floor was tightened to >= 3 in 0012
-- (reclaim_list_min_3), which would now REJECT a valid sub-3 signup at persist time. reclaim_item rows remain
-- the source of truth. Idempotent.
alter table member_profile drop constraint if exists reclaim_list_min_3;
alter table member_profile drop constraint if exists reclaim_list_min_1;
alter table member_profile add constraint reclaim_list_min_1
  check (reclaim_list is null or jsonb_array_length(reclaim_list) >= 1);
