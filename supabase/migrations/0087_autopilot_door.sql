-- 0087 — Autopilot becomes the 12th Door.
--
-- WHY. It shipped on 2026-08-18 as a special "quiet-drift card" that was deliberately NOT a Door, reasoning that
-- it was a stance in a taxonomy of events — the reasoning that retired The Acceptance. Reading Greg's R2 Gated
-- Asset V4 on 2026-08-22 showed that to be a category error: he names the Autopilot Door three times, includes it
-- in the required minimum ("the door set rendered in R2 includes at minimum Relationship, Social, Autopilot"), and
-- has it rated for relevance like every other Door. Acceptance was a conclusion a member DREW; Autopilot is a
-- pattern Greg groups with caregiving and career absorption.
--
-- MEMBER-CLAIMABLE ONLY. It carries no matcher aliases and lib/doors.ts skips it in matchDoors, so nothing infers
-- it from a member's words — which is the risk the 8/18 ruling was actually protecting against. She sees it on the
-- board and rates it herself.
--
-- SAFE TO RE-RUN. Idempotent, additive, no data is moved or deleted; existing member_door rows are untouched.

-- The Acceptance keeps its row so historical member_door rows stay valid; the code has never derived it since
-- 2026-08-15. Moving it to 99 keeps it out of the live set's ordering rather than colliding with Autopilot at 12.
update door set sort_order = 99 where slug = 'acceptance';

insert into door (slug, display_name, descriptor, sort_order) values
  ('autopilot', 'Autopilot',
   'Decades of routine without reflection — you didn''t choose to lose yourself, you just stopped paying attention.',
   12)
on conflict (slug) do update
  set display_name = excluded.display_name,
      descriptor   = excluded.descriptor,
      sort_order   = excluded.sort_order;
