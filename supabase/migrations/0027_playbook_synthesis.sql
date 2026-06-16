-- 0027: The Playbook synthesis — a living narrative the Member Agent maintains across Sessions
-- (where you were → how the gap opened → where you are → new intentions/habits → where you're headed),
-- woven from the member's own words + journey data. Refreshed on each Session close; surfaced as a
-- Checkpoint's richest material. The meaningful version of the retired "Story so Far."
alter table member_profile add column if not exists playbook_synthesis text;
