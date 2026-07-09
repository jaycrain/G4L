-- Seed a W1 true line + a W2 image keeper onto ONE member, so Rewire W3 (the False Start Protocol) can pull the REAL
-- toolkit forward and the "it's clicking together" moment is walkable WITHOUT re-doing W1 and W2. Paste into the
-- Supabase SQL Editor. Staged-only felt-walk data — safe, additive, idempotent-ish (guarded against re-inserting).
--
-- 1) Find your member_id (it's also the last path segment of your /dashboard/<id> URL):
--      select member_id, display_name, email from member_profile order by created_at desc limit 20;
-- 2) Paste it below, then run.

do $$
declare
  m uuid := '<<PASTE_MEMBER_ID_HERE>>';  -- e.g. '2b1f...'
begin
  -- W1 output: a true line (principle keeper) — what W3's Reframe offers back.
  if not exists (select 1 from playbook_entry where member_id = m and keeper_type = 'principle' and state = 'kept') then
    insert into playbook_entry (member_id, section, body, authorship, state, keeper_type)
    values (m, 'own_words', 'I won''t know what I''m capable of until I actually try', 'gathered', 'kept', 'principle');
  end if;

  -- W2 output: the image (lights_you_up keeper) — what W3's Restart points to.
  if not exists (select 1 from playbook_entry where member_id = m and keeper_type = 'lights_you_up' and state = 'kept') then
    insert into playbook_entry (member_id, section, body, authorship, state, keeper_type)
    values (m, 'own_words',
      'The half-marathon finish line — a cool morning, the chute ahead, my kids at the rail, and I feel like I came back',
      'gathered', 'kept', 'lights_you_up');
  end if;
end $$;

-- Verify:
--   select keeper_type, body from playbook_entry
--   where member_id = '<<PASTE_MEMBER_ID_HERE>>' and state='kept' and keeper_type in ('principle','lights_you_up');
