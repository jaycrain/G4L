-- ONE-OFF DATA REPAIR — jaycrain@mac.com, charter walk 2026-08-25. Not a migration; run once, then delete.
--
-- WHY. Two fields on his profile are wrong because of the tap-leak bug found during the walk
-- (onboarding-staged.ts:1829 joins the raw member message into the gap on any 'addition', and on a TAP that
-- message is the wire string). His stored fade story reads:
--
--   "I stopped riding with intention. No training, no race out there motivating me. The riding kept happening,
--    but more of a stress relief. [gap-confirm] more keep:grind. What does The Grind mean? Would you consider
--    the stress with my wife and gaining weight a Door"
--
-- Three faults: the wire marker `[gap-confirm] more keep:grind` is presented as something he wrote; two
-- QUESTIONS he asked the Companion became chapters of how his identity loss happened; and the actual chapters
-- (the film, the strain at home, the weight) are missing. `intake_athletic_past` is empty for a separate reason
-- — he answered it and it never stored (walk log Q8, unfixed).
--
-- THIS MATTERS BEYOND TIDINESS: intake_gap feeds Reconnect's opener and the Companion's context, so the product
-- would read his own questions back to him as his story.
--
-- EVERY WORD BELOW IS HIS, VERBATIM, from the onboarding transcript, in the order he said it. Nothing is
-- composed, summarised or tidied — the standing rule is the member's exact span, never our phrasing of it. The
-- separator is ". ", matching joinGapChapters (onboarding-staged.ts:524).
--
-- His turns, for the record:
--   "We got behind on the film and it became stressful"
--   "I stopped riding with intention. No training, no race out there motivating me. The riding kept happening,
--    but more of a stress relief"
--   "It created a lot of stress between my wife and me"
--   "It took all of the fun out of it and made it stressful"
--   "I started gaining weight"
--
-- SCOPED TO ONE EMAIL and guarded on the corruption still being present, so re-running it cannot clobber a
-- later, better value — if he edits his own story through the Companion, this becomes a no-op.

begin;

update member_profile
   set intake_gap = 'We got behind on the film and it became stressful. '
                 || 'I stopped riding with intention. No training, no race out there motivating me. '
                 || 'The riding kept happening, but more of a stress relief. '
                 || 'It created a lot of stress between my wife and me. '
                 || 'It took all of the fun out of it and made it stressful. '
                 || 'I started gaining weight.'
 where lower(email) = 'jaycrain@mac.com'
   and intake_gap like '%[gap-confirm]%';

update member_profile
   set intake_athletic_past = 'Setting PRs, riding long, scaling the hard climbs around Boulder, and doing gravel races'
 where lower(email) = 'jaycrain@mac.com'
   and coalesce(intake_athletic_past, '') = '';

-- Read it back before committing. Expect one row, no bracket, six chapters, and a non-empty past.
select email,
       intake_gap like '%[gap-confirm]%' as still_polluted,
       length(intake_gap)                as gap_len,
       intake_athletic_past
  from member_profile
 where lower(email) = 'jaycrain@mac.com';

commit;
