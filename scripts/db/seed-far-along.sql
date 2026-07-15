-- Seed a FAR-ALONG demo account for walking the redesign's late-stage states.
-- Run in the Supabase SQL Editor (prod DB — the Vercel Preview reads it). Idempotent + reversible.
--
-- Target: the demo member (Reshma) lands mid-REBUILD —
--   • Reconnect + Rewire COMPLETE (gates) → both rings solid on the navy hero
--   • Rewire W1/W2/W3 + Rebuild B1/B2 CLOSED → milestone badges earned; ring reads Rebuild 2 of 3
--   • an active B2 "noticing" practice week → the practice-week hero + "Or move on to The Lifestyle Pilot" link (no strand)
--   • a populated "Revisit a session" list: Reconnect / W1 / W2 / W3 / B1 / B2, with real kept artifacts for W1–W3
--
-- Assumes the member already has their onboarding captures (identity "the Runner", Door "The Diagnosis", Reclaim List).
-- Scoped to ONE member id; safe to re-run. See the RESET block at the bottom to return the account to pre-seed.

-- 1) Phase gates → Reconnect + Rewire complete; Rebuild becomes "You're here" (activePhaseIndex = 2).
insert into phase_gate (member_id, gate) values
  ('13526e58-1ab1-43b3-925f-5fbd53d1884e', 'reconnect_checkpoint_passed'),
  ('13526e58-1ab1-43b3-925f-5fbd53d1884e', 'rewire_checkpoint_passed')
on conflict do nothing;

-- 2) Close sessions — AGED past the 10-min "just finished" window so the hero shows the practice week (not a
--    completion beat). Closing these also earns the milestone badges (turned-voice … honest-read).
insert into session_progress (member_id, session_id, status, closed_at) values
  ('13526e58-1ab1-43b3-925f-5fbd53d1884e', 'RWR-W1',  'closed', now() - interval '6 days'),
  ('13526e58-1ab1-43b3-925f-5fbd53d1884e', 'RWR-W2',  'closed', now() - interval '5 days'),
  ('13526e58-1ab1-43b3-925f-5fbd53d1884e', 'RWR-W3',  'closed', now() - interval '4 days'),
  ('13526e58-1ab1-43b3-925f-5fbd53d1884e', 'RBLD-B1', 'closed', now() - interval '3 days'),
  ('13526e58-1ab1-43b3-925f-5fbd53d1884e', 'RBLD-B2', 'closed', now() - interval '2 days')
on conflict (member_id, session_id) do update set status = 'closed', closed_at = excluded.closed_at, updated_at = now();

-- 3) The active B2 "noticing" practice week (Rebuild Part B) → the practice-week hero, B3 still the lit next step.
insert into practice_week (member_id, kind, started_at) values
  ('13526e58-1ab1-43b3-925f-5fbd53d1884e', 'b2_noticing', now() - interval '2 days')
on conflict (member_id, kind) do update set started_at = excluded.started_at;

-- 4) Kept artifacts for the Rewire session reviews (idempotent: clear prior seed keepers first, by their marker).
delete from playbook_entry where member_id = '13526e58-1ab1-43b3-925f-5fbd53d1884e' and source_ref = 'seed-far-along';
insert into playbook_entry (member_id, section, body, authorship, state, keeper_type, source_kind, source_ref, source_label, sort_order) values
  ('13526e58-1ab1-43b3-925f-5fbd53d1884e', 'own_words', 'The diagnosis changed my body, not who I am.',                              'gathered', 'kept', 'principle',     'own', 'seed-far-along', 'Your true line',           0),
  ('13526e58-1ab1-43b3-925f-5fbd53d1884e', 'own_words', 'One slow mile is still a mile — I''m still a runner.',                       'gathered', 'kept', 'principle',     'own', 'seed-far-along', 'Your true line',           1),
  ('13526e58-1ab1-43b3-925f-5fbd53d1884e', 'own_words', 'A year out: back on the trail at dawn, breathing easy, my daughter riding alongside me.', 'gathered', 'kept', 'lights_you_up', 'own', 'seed-far-along', 'The picture',              2),
  ('13526e58-1ab1-43b3-925f-5fbd53d1884e', 'own_words', 'When I miss a week: no guilt, no story — I lace up the next morning and run one easy mile.', 'gathered', 'kept', 'recovery_move', 'own', 'seed-far-along', 'Your clip-back-in move',   3);

-- ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- RESET (undo the seed) — run this block to return the demo member to its pre-seed state:
--
-- delete from phase_gate       where member_id = '13526e58-1ab1-43b3-925f-5fbd53d1884e' and gate in ('reconnect_checkpoint_passed','rewire_checkpoint_passed');
-- delete from session_progress where member_id = '13526e58-1ab1-43b3-925f-5fbd53d1884e' and session_id in ('RWR-W1','RWR-W2','RWR-W3','RBLD-B1','RBLD-B2');
-- delete from practice_week    where member_id = '13526e58-1ab1-43b3-925f-5fbd53d1884e' and kind = 'b2_noticing';
-- delete from playbook_entry   where member_id = '13526e58-1ab1-43b3-925f-5fbd53d1884e' and source_ref = 'seed-far-along';
