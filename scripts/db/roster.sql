-- WHO IS ON PROD — READ ONLY. Paste into the Supabase SQL Editor and Run. Deletes nothing.
--
-- Exists because the wipe scripts next to it take an email list, and the only safe way to write that list is from
-- the real roster rather than from memory. Run this first, every time.
--
-- Reads the profile AND the in-flight onboarding table, because those are two different kinds of account and a
-- roster showing only the first will quietly under-count. `onboarding_session` is keyed by EMAIL and holds the
-- conversation of anyone who started and has not yet tapped through the summary card: they own the most sensitive
-- text in the product and they have no member row at all. (This is the same gap that made a "successful" wipe do
-- nothing in August — see purge-member.sql.)
--
-- Table names verified against supabase/migrations, not from memory: playbook_entry (0017, NOT playbook_item),
-- arc_session (0056), reclaim_item (0014), member_event (0028), onboarding_session (0016 — which has updated_at
-- and no created_at, so there is no "started" date to show for an in-flight account).

-- ── 1 · Real accounts, most recently active first ────────────────────────────────────────────────────────────
select
  p.email,
  p.display_name,
  p.created_at::date                                                     as joined,
  p.identity_noun                                                        as identity,
  (select count(*) from arc_session    s where s.member_id = p.member_id) as sessions,
  (select count(*) from playbook_entry e where e.member_id = p.member_id) as playbook,
  (select count(*) from reclaim_item   r where r.member_id = p.member_id) as reclaim_items,
  (select max(v.created_at)::date from member_event v where v.member_id = p.member_id) as last_seen
from member_profile p
order by last_seen desc nulls last, p.created_at desc;

-- ── 2 · In-flight onboarding — started, never finished. No member row exists for these. ──────────────────────
select
  o.email,
  o.updated_at::date as last_touched,
  jsonb_array_length(o.messages) as turns
from onboarding_session o
where lower(o.email) not in (select lower(email) from member_profile)
order by o.updated_at desc;

-- ── 3 · The count, both kinds ────────────────────────────────────────────────────────────────────────────────
select
  (select count(*) from member_profile) as profiles,
  (select count(*) from onboarding_session
     where lower(email) not in (select lower(email) from member_profile)) as in_flight_only;
