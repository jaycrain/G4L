-- Restore the line W2 dropped from Jay's picture (2026-08-11).
--
-- WHY: holdStage.gather never read the member's answer to "When you're ready, tell me what comes up", so the richest
-- piece of his scene was discarded while "Big Sugar for sure" was kept. Fixed in e9fef41 for future sessions; this
-- repairs the record that already exists. W3's Restart reads THIS row (latestImageKeeper), which is why it was
-- quoting "Big Sugar for sure. No, the Starting Line." back at him at the moment it mattered most.
--
-- His words, verbatim. Do not tidy them.
-- Run in the Supabase SQL Editor. Step 1 shows what will change; step 2 changes it; step 3 confirms.

-- ── 1. LOOK FIRST ───────────────────────────────────────────────────────────────────────────────────────────────
select e.id, e.created_at, e.state, e.keeper_type, e.body
from playbook_entry e
join member_profile m on m.member_id = e.member_id
where m.email = 'jay@adjacentlabmedia.com'
  and e.keeper_type = 'lights_you_up'
  and e.state = 'kept'
order by e.created_at desc;

-- ── 2. APPEND (only the newest one, and only if it isn't already there) ──────────────────────────────────────────
update playbook_entry e
set body = e.body || E'\nThe energy of a thousand other racers around me and them behind the barriers cheering. The noise, I love that noise and anticipation'
from member_profile m
where m.member_id = e.member_id
  and m.email = 'jay@adjacentlabmedia.com'
  and e.keeper_type = 'lights_you_up'
  and e.state = 'kept'
  and e.body not like '%thousand other racers%'          -- idempotent: safe to run twice
  and e.id = (
    select e2.id from playbook_entry e2
    where e2.member_id = e.member_id and e2.keeper_type = 'lights_you_up' and e2.state = 'kept'
    order by e2.created_at desc limit 1
  );

-- ── 3. CONFIRM ──────────────────────────────────────────────────────────────────────────────────────────────────
select e.body
from playbook_entry e
join member_profile m on m.member_id = e.member_id
where m.email = 'jay@adjacentlabmedia.com'
  and e.keeper_type = 'lights_you_up'
  and e.state = 'kept'
order by e.created_at desc limit 1;
