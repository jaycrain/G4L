-- WIPE EVERY ACCOUNT EXCEPT A KEEP-LIST. Paste into the Supabase SQL Editor. Destructive and not reversible.
--
-- Different shape from wipe-test-accounts.sql, on purpose. That one names its TARGETS, which is right when you
-- are removing two known rows. This one names its SURVIVORS, which is the only safe shape for "clear the decks"
-- — a target list silently misses whatever you forgot existed, and the whole point here is that you do not know
-- the full roster.
--
-- The cost of that shape: a typo in the keep-list deletes the person you meant to protect. So STEP 1 is a preview
-- that shows exactly who lives and who dies, and it is not optional. Run it, read it, then run Step 2.
--
-- RUN scripts/db/roster.sql FIRST if you have not — the keep-list below should be written from the real roster.

-- ═══ STEP 1 · PREVIEW — read only, deletes nothing. Run this and read every row. ═════════════════════════════
with keep as (
  select lower(unnest(array[
    -- ── people ──────────────────────────────────────────────────────────────────────────────────────────────
    'gjwg4l1@gmail.com',                -- Greg Welk. CONFIRMED from the admin roster 2026-08-27 (Grind / Reclaim,
                                        -- ID 81, 15 sessions, 15 of 16 badges). NOT gdc@gdc.com — that address
                                        -- appears in wipe-test-accounts.sql as a DELETION TARGET, and I had it
                                        -- in this keep-list from that example. Left unchecked it would have
                                        -- deleted the one account named to keep, and kept a test account.
    -- DONNA IS DELIBERATELY NOT KEPT (Jay, 2026-08-27). I first argued to keep her because "several open items
    -- need her state to reproduce" — an assertion I had not checked. Checked: every one of D2–D16 still open is
    -- copy, CSS or engine behaviour. D4's evidence is a screenshot in her email, not a row. D3 and D13 are
    -- capture-loop bugs, and the documented way to reproduce those is a replay fixture, not a live run.
    -- purge-member.ts already lists her as purgeable precisely BECAUSE she re-walks from the front door on every
    -- intake change — preserving her account works against the job she does.
    --
    -- ── demo accounts the TOOLING depends on. Losing these breaks things you use daily. ──────────────────────
    'demo-tom@grintaforlife.test',      -- SMOKE_EMAIL. `npm run smoke` logs in as this after every deploy and
                                        -- refuses non-.test accounts. Wipe it and the post-deploy gate dies.
    'fresh@grintaforlife.test',         -- /admin/fresh — the only way to see the Threshold ceremony, the
                                        -- Opening Tour and the empty states.
    -- ── AND THE ONE THAT IS NOT A PERSON AT ALL ─────────────────────────────────────────────────────────────
    'founders@system.grintaforlife.internal'
                                        -- "The Founders" — the authoring identity for Community posts, because
                                        -- connect_post.author_id is NOT NULL and references member_profile. It
                                        -- was in the DELETE list on the 8/27 run and caught with one paste to
                                        -- spare. That FK is ON DELETE CASCADE, so removing it takes every post
                                        -- signed "The Founders" with it, including the seeded Session topics.
                                        -- A roster read as "people" hides it: it has a display name, a member
                                        -- row, and no way to look like infrastructure.
  ])) as email
)
select
  coalesce(p.email, o.email)                                     as email,
  case when p.member_id is null then 'in-flight onboarding' else 'member' end as kind,
  p.display_name,
  case when lower(coalesce(p.email, o.email)) in (select email from keep)
       then 'KEEP' else '>>> DELETE <<<' end                     as verdict
from member_profile p
full outer join onboarding_session o on lower(o.email) = lower(p.email)
order by verdict, kind, email;

-- ═══ STEP 1b · DOES EVERY KEEP-LIST ENTRY ACTUALLY MATCH SOMEBODY? ═══════════════════════════════════════════
-- The failure this catches: a typo in the keep-list does not announce itself. The intended survivor simply shows
-- up in Step 1 under DELETE, one row among fifteen, and reads as just another account you did not recognise.
-- Nothing is highlighted and nothing errors — you find out afterwards.
--
-- So ask the question directly. EVERY row this returns is a keep-list entry that protects nobody. Expect zero.
-- Real: it is how gdc@gdc.com sat in this list as "Greg" until the roster was checked.
with keep as (
  select lower(unnest(array[
    'gjwg4l1@gmail.com',
    'demo-tom@grintaforlife.test',
    'fresh@grintaforlife.test',
    'founders@system.grintaforlife.internal'
  ])) as email
)
select k.email as keep_list_entry_matching_nothing
from keep k
where not exists (select 1 from member_profile     p where lower(p.email) = k.email)
  and not exists (select 1 from onboarding_session o where lower(o.email) = k.email);

-- ═══ STEP 2 · THE WIPE. Only after Step 1 reads the way you intend. ══════════════════════════════════════════
-- Single DO block = one atomic statement. The editor runs statements separately, so a BEGIN..COMMIT script
-- would NOT stay atomic here; this does.
do $$
declare
  keep text[] := array[
    'gjwg4l1@gmail.com',
    'demo-tom@grintaforlife.test',
    'fresh@grintaforlife.test',
    'founders@system.grintaforlife.internal'
  ];
  ids uuid[];
  n_sessions int;
begin
  -- KEEP THE TWO LISTS IDENTICAL. They are written twice because Step 1 must be runnable on its own; if you
  -- edit one, edit both. (A mismatch means the preview lied, which is worse than no preview.)
  perform set_config('g4l.actor', 'admin-cleanup', true);

  select array_agg(member_id) into ids
  from member_profile
  where lower(email) <> all (select lower(unnest(keep)));

  -- IN-FLIGHT ONBOARDING IS AN ACCOUNT TOO. Keyed by EMAIL with no member FK, so no cascade reaches it and the
  -- member_id delete below cannot see it. Skipping it leaves the member's onboarding CONVERSATION behind — the
  -- most sensitive text in the product — while every other trace is gone. (Found 2026-07-30 on a "clean" wipe;
  -- then again in August, when a purged tester reopened the front door and resumed the same conversation.)
  -- Deleted by email and INDEPENDENTLY of the profile, so it also clears people who never finished.
  delete from onboarding_session where lower(email) <> all (select lower(unnest(keep)));
  get diagnostics n_sessions = row_count;

  if ids is null then
    raise notice 'No member profiles to wipe. Cleared % in-flight onboarding session(s).', n_sessions;
    return;
  end if;

  -- The five children that lack ON DELETE CASCADE. Clear before the profile or the delete fails.
  delete from idq_retake           where member_id = any(ids);
  delete from asset_event          where member_id = any(ids);
  delete from asset_completion     where member_id = any(ids);
  delete from grinta_reading       where member_id = any(ids);
  delete from founder_agent_drafts where member_id = any(ids);

  -- The profile. Every ON DELETE CASCADE child (credentials, sessions, arc_session, playbook, member_event,
  -- connect_*, telemetry, …) clears automatically. A '_deleted' audit row is recorded per account by the 0032
  -- trigger — forensic, by design; member_profile_audit has no FK.
  delete from member_profile where member_id = any(ids);

  raise notice 'Wiped % member account(s) and % in-flight session(s).', array_length(ids, 1), n_sessions;
end $$;

-- ═══ STEP 3 · VERIFY — the survivors, and nothing else. ══════════════════════════════════════════════════════
select 'members' as kind, email from member_profile
union all
select 'in-flight', email from onboarding_session
order by kind, email;
