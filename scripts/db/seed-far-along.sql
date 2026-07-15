-- Seed a FAR-ALONG demo account for walking the redesign's late-stage states.
-- Run in the Supabase SQL Editor (prod DB — the Vercel Preview reads it). Idempotent + reversible.
--
-- Resolves the member by EMAIL (ids differ per environment), so set the email below to the demo account you walk as.
-- If the final SELECT returns 0 rows, the email is wrong — run:  select member_id, email, display_name from member_profile;
-- ...find your demo account, and swap the email everywhere below.
--
-- Target: the member lands mid-REBUILD —
--   • Reconnect + Rewire COMPLETE (gates) → both rings solid on the navy hero
--   • Rewire W1/W2/W3 + Rebuild B1/B2 CLOSED → milestone badges earned; ring reads Rebuild 2 of 3
--   • an active B2 "noticing" practice week → the practice-week hero + "Or move on to The Lifestyle Pilot" link
--   • a populated "Revisit a session" list: Reconnect / W1 / W2 / W3 / B1 / B2, with kept artifacts for W1–W3
-- Assumes the account already has its onboarding captures (identity / Door / Reclaim List).

-- 1) Phase gates → Reconnect + Rewire complete; Rebuild becomes "You're here".
insert into phase_gate (member_id, gate)
select mp.member_id, g.gate
from member_profile mp
cross join (values ('reconnect_checkpoint_passed'), ('rewire_checkpoint_passed')) as g(gate)
where mp.email = 'jay@jay.com'
on conflict do nothing;

-- 2) Close sessions — AGED past the 10-min "just finished" window so the hero shows the practice week (not a
--    completion beat). Closing these also earns the milestone badges (turned-voice … honest-read).
insert into session_progress (member_id, session_id, status, closed_at)
select mp.member_id, s.session_id, 'closed', now() - s.age
from member_profile mp
cross join (values
  ('RWR-W1', interval '6 days'), ('RWR-W2', interval '5 days'), ('RWR-W3', interval '4 days'),
  ('RBLD-B1', interval '3 days'), ('RBLD-B2', interval '2 days')
) as s(session_id, age)
where mp.email = 'jay@jay.com'
on conflict (member_id, session_id) do update set status = 'closed', closed_at = excluded.closed_at, updated_at = now();

-- 3) The active B2 "noticing" practice week (Rebuild Part B) → the practice-week hero, B3 still the lit next step.
insert into practice_week (member_id, kind, started_at)
select mp.member_id, 'b2_noticing', now() - interval '2 days'
from member_profile mp
where mp.email = 'jay@jay.com'
on conflict (member_id, kind) do update set started_at = excluded.started_at;

-- 4) Kept artifacts for the Rewire session reviews (idempotent: clear prior seed keepers first, by their marker).
delete from playbook_entry
where source_ref = 'seed-far-along'
  and member_id = (select member_id from member_profile where email = 'jay@jay.com');

insert into playbook_entry (member_id, section, body, authorship, state, keeper_type, source_kind, source_ref, source_label, sort_order)
select mp.member_id, 'own_words', k.body, 'gathered', 'kept', k.keeper_type, 'own', 'seed-far-along', k.label, k.ord
from member_profile mp
cross join (values
  ('The setback changed my situation, not who I am.',                                           'principle',     'Your true line',         0),
  ('One small effort still counts — I''m still in this.',                                        'principle',     'Your true line',         1),
  ('A year out: back doing the thing I love, steady and strong, present for the people who matter.', 'lights_you_up', 'The picture',        2),
  ('When I slip: no guilt, no story — I start again the next morning with one small step.',      'recovery_move', 'Your clip-back-in move', 3)
) as k(body, keeper_type, label, ord)
where mp.email = 'jay@jay.com';

-- CONFIRM it landed (expect: gates 2, closed 5, practice_weeks 1, seed_keepers 4). 0 rows here = wrong email above.
select mp.display_name, mp.email,
  (select count(*) from phase_gate where member_id = mp.member_id) as gates,
  (select count(*) from session_progress where member_id = mp.member_id and status = 'closed') as closed,
  (select count(*) from practice_week where member_id = mp.member_id) as practice_weeks,
  (select count(*) from playbook_entry where member_id = mp.member_id and source_ref = 'seed-far-along') as seed_keepers
from member_profile mp
where mp.email = 'jay@jay.com';

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- RESET (undo the seed) — run this block to return the demo member to its pre-seed state:
--
-- delete from phase_gate       where gate in ('reconnect_checkpoint_passed','rewire_checkpoint_passed') and member_id = (select member_id from member_profile where email = 'jay@jay.com');
-- delete from session_progress where session_id in ('RWR-W1','RWR-W2','RWR-W3','RBLD-B1','RBLD-B2')       and member_id = (select member_id from member_profile where email = 'jay@jay.com');
-- delete from practice_week    where kind = 'b2_noticing'                                                 and member_id = (select member_id from member_profile where email = 'jay@jay.com');
-- delete from playbook_entry   where source_ref = 'seed-far-along'                                        and member_id = (select member_id from member_profile where email = 'jay@jay.com');
