-- Wipe test accounts + ALL their data. Paste into the Supabase SQL Editor and Run.
-- Single DO block = one atomic statement (the editor runs each statement separately, so a
-- multi-statement temp-table/BEGIN..COMMIT script does NOT stay atomic there — this does).
-- Records a '_deleted' audit row per account (forensic, by design; member_profile_audit has no FK).
--
-- Edit the two emails below to reuse for other accounts.
do $$
declare
  ids uuid[];
begin
  -- Audit trail attribution, transaction-local.
  perform set_config('g4l.actor', 'admin-cleanup', true);

  -- Targets: resolve member_ids from the profile AND the login credential (belt + suspenders).
  select array_agg(member_id) into ids from (
    select member_id from member_profile    where lower(email) in ('jay@jay.com','gdc@gdc.com')
    union
    select member_id from member_credential where lower(email) in ('jay@jay.com','gdc@gdc.com')
  ) t;

  if ids is null then
    raise notice 'No matching accounts — nothing to wipe.';
    return;
  end if;

  -- Non-cascading children (these five lack ON DELETE CASCADE — clear them before the profile).
  delete from idq_retake           where member_id = any(ids);
  delete from asset_event          where member_id = any(ids);
  delete from asset_completion     where member_id = any(ids);
  delete from grinta_reading       where member_id = any(ids);
  delete from founder_agent_drafts where member_id = any(ids);

  -- IN-FLIGHT ONBOARDING. Keyed by EMAIL with no member FK, so it is NOT reached by the member_id delete
  -- below and NOT covered by any cascade — a wipe that skips it leaves the member's onboarding CONVERSATION
  -- behind (the most sensitive text in the product) while every other trace is gone. Delete by the same
  -- emails the targets were resolved from. (Found 2026-07-30: yesterday's "clean" wipe left these behind.)
  delete from onboarding_session where lower(email) in (select lower(email) from member_profile where member_id = any(ids));

  -- The profile. Every ON DELETE CASCADE child (credentials, sessions, arc_session, playbook,
  -- member_event, connect_*, telemetry, …) clears automatically.
  delete from member_profile where member_id = any(ids);

  raise notice 'Wiped % account(s).', array_length(ids, 1);
end $$;

-- Verify (should return 0 for BOTH): the profile, and any in-flight onboarding for those emails.
select
  (select count(*) from member_profile     where lower(email) in ('jay@jay.com','gdc@gdc.com')) as profiles_remaining,
  (select count(*) from onboarding_session where lower(email) in ('jay@jay.com','gdc@gdc.com')) as sessions_remaining;
