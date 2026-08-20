-- PURGE A TEST ACCOUNT — paste-ready for the Supabase SQL Editor.
--
-- WHY THIS FILE EXISTS. lib/demo/purge-member.ts is the real authority and /admin/fresh runs it, but the wipe is
-- also done by hand from the SQL Editor (Jay's usual path for prod data), and I had been RETYPING it each time.
-- Twice now that retyping produced `min(member_id)` to resolve the row — and `min(uuid)` has no aggregate in
-- Postgres, so it failed at the first statement. The second time I had written a paragraph warning about that
-- exact trap in the same message, and then did it anyway.
--
-- A grep-guard cannot catch this: there is no live `min(<id>)` anywhere in the repo, because the mistake only ever
-- existed in SQL typed into a chat window. So the fix is to stop typing it. This file is the paste.
--
-- MIRRORS lib/demo/purge-member.ts EXACTLY — same seven explicit deletes, same order, same refusals. If that
-- module's BLOCKING_TABLES change, change them here too; tests/purge-member.test.ts re-derives that list from the
-- migrations and will tell you when it drifts.
--
-- AN IN-FLIGHT ONBOARDING IS AN ACCOUNT TOO, and it used to survive this script.
--
-- `onboarding_session` is keyed by EMAIL, not member_id — no member row exists until she taps "This is me" on the
-- summary card — so it hangs off nothing this file was deleting and no cascade could reach it. Wiping a tester who
-- had stopped at the card therefore looked like a success and changed nothing: she reopened the front door and
-- resumed the same conversation, at the same card, with the same captures. Donna, 2026-08-20.
--
-- So the session is deleted FIRST and INDEPENDENTLY of the profile, and "nothing found" now means neither existed.
--
-- SAFE TO RE-RUN: a second run raises "No account found" and deletes nothing.
-- EDIT ONE LINE: v_email, below. The account must be on PURGEABLE in lib/demo/purge-member.ts.

begin;

do $$
declare
  v_email    text := 'donnacrain19@gmail.com';   -- <<< the only line to change
  v_id       uuid;
  v_n        int;
  v_sessions int;
begin
  -- The in-flight conversation. Deleted whether or not she ever finished — this is the half that makes "start
  -- over from the front door" mean what it says.
  delete from onboarding_session where lower(email) = lower(v_email);
  get diagnostics v_sessions = row_count;

  -- COUNT first, then FETCH. Never an aggregate over the uuid — min(uuid) does not exist, and reaching for it is
  -- how both previous attempts died. Counting first is also what makes the two refusals below possible.
  select count(*) into v_n
  from member_profile where lower(email) = lower(v_email);

  -- The two ways this could touch the wrong person, refused rather than guessed.
  if v_n = 0 then
    if v_sessions = 0 then
      raise exception 'No account and no in-flight onboarding for % — nothing deleted.', v_email;
    end if;
    -- She had only got as far as the conversation. That IS the whole account; we are done.
    raise notice 'Purged in-flight onboarding for % (no member row existed)', v_email;
    return;
  elsif v_n > 1 then
    raise exception 'Found % accounts for % — refusing to guess.', v_n, v_email;
  end if;

  select member_id into v_id
  from member_profile where lower(email) = lower(v_email);

  -- The SIX FKs with no ON DELETE rule. They do not cascade and they do not null — they BLOCK the profile delete
  -- outright, so they go first, children before parents.
  delete from member_profile_audit  where member_id = v_id;
  delete from idq_retake            where member_id = v_id;
  delete from asset_event           where member_id = v_id;
  delete from asset_completion      where member_id = v_id;
  delete from founder_agent_drafts  where member_id = v_id;
  delete from grinta_reading        where member_id = v_id;

  -- member_id with NO foreign key at all: it neither blocks nor cascades, so it is invisible in both directions
  -- and left behind forever unless cleared explicitly.
  delete from member_access_log     where member_id = v_id;

  -- 43 tables cascade from here. member_feedback deliberately does NOT: its FK is `on delete set null`, so a
  -- tester's reports outlive their account. That is the schema's decision, not an oversight.
  delete from member_profile        where member_id = v_id;

  raise notice 'Purged % (member_id %, % in-flight session(s))', v_email, v_id, v_sessions;
end $$;

commit;

-- VERIFY AFTERWARDS, and verify against a CONTROL. The diagnostic endpoint omits `matchCount` entirely when there
-- is no match, so a check written as `matchCount === 0` reads undefined and reports the purge FAILED over a purge
-- that worked. Compare the response for the purged address against a made-up one: identical shape means gone.
--   node --env-file-if-exists=.env.local -e "…/api/admin/member-diagnostic?q=<email>"
