-- BACKFILL: checkpoint completions that were never recorded.
--
-- Paste into the Supabase SQL Editor (DATABASE_URL is Sensitive in Vercel, so this doesn't go through db:migrate).
-- Safe to run more than once.
--
-- WHY. Until 2026-08-07 the five checkpoint-completion sites set the phase gate and emitted checkpoint_cross but
-- never wrote a session_progress row. The PRODUCT was fine — getForecast reads the gate — but every counter and
-- every QI rollup reads session_progress, so a crossed checkpoint was invisible. Greg finished all four and showed
-- as 12 completions instead of 16. markCheckpointClosed fixes it going forward; it can't fix anyone who already
-- crossed, because they will never cross again this cycle. Hence this.
--
-- WHAT IT DOES NOT DO. It does not emit checkpoint_cross — those events already exist for these members and
-- inventing more would corrupt the very telemetry this is meant to repair. It only writes the missing rows, and
-- back-dates closed_at to when the gate was actually passed rather than stamping today, so time-on-asset and the
-- completion order stay truthful.
--
-- Note the id mapping: the progress row is keyed by the CURRICULUM asset id (RBLD-B4 / RCL-C4), which is what
-- getForecast matches on — NOT the event ref (RBD-CHK / RCL-CHK). See lib/curriculum/store.ts markCheckpointClosed.

insert into session_progress (member_id, session_id, status, closed_at, updated_at)
select g.member_id, m.asset_id, 'closed', g.set_at, g.set_at
from phase_gate g
join (values
        ('reconnect_checkpoint_passed', 'RCN-CHK'),
        ('rewire_checkpoint_passed',    'RWR-CHK'),
        ('rebuild_checkpoint_passed',   'RBLD-B4'),
        ('reclaim_checkpoint_passed',   'RCL-C4')
     ) as m(gate, asset_id) on m.gate = g.gate
where not exists (
  select 1 from session_progress s
  where s.member_id = g.member_id and s.session_id = m.asset_id
)
on conflict (member_id, session_id) do nothing;

-- Verify: should return 0 rows once the backfill has run.
-- select g.member_id, g.gate
-- from phase_gate g
-- join (values ('reconnect_checkpoint_passed','RCN-CHK'), ('rewire_checkpoint_passed','RWR-CHK'),
--              ('rebuild_checkpoint_passed','RBLD-B4'), ('reclaim_checkpoint_passed','RCL-C4')) as m(gate, asset_id)
--   on m.gate = g.gate
-- where not exists (select 1 from session_progress s
--                   where s.member_id = g.member_id and s.session_id = m.asset_id and s.status = 'closed');
