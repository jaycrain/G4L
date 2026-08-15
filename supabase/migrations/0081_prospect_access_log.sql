-- ONE ACCESS LOG, NOT TWO (2026-08-15).
--
-- member_access_log answers two questions: "who has looked at THIS person?" and "what has THIS operator looked
-- at?" Prospects — people mid-onboarding, with no member row — were about to become visible in the console, and
-- their transcript is the most vulnerable text in the product: the gap, in their own first-person words, from
-- someone who never finished signing up and never agreed to anything.
--
-- The column was `member_id uuid not null`, so a prospect could not be recorded at all. The tempting fix is a
-- second table. That would be a mistake: the moment there are two logs, "has anyone read this person's story?"
-- needs two queries, and the day someone forgets the second one is the day the answer is quietly wrong.
--
-- So the log keeps ONE row shape and gains a second way to name who was read. Exactly one of the two is set.
alter table member_access_log alter column member_id drop not null;
alter table member_access_log add column if not exists prospect_email text;

-- Neither-or-both is meaningless, and a row that names nobody is worse than no row: it reads as diligence while
-- recording nothing. The constraint makes that unrepresentable rather than merely discouraged.
alter table member_access_log drop constraint if exists member_access_log_subject;
alter table member_access_log add constraint member_access_log_subject
  check ((member_id is not null) <> (prospect_email is not null));

create index if not exists member_access_log_prospect_idx
  on member_access_log (prospect_email, at desc)
  where prospect_email is not null;

comment on column member_access_log.prospect_email is
  'Set instead of member_id when an operator revealed the transcript of someone still in onboarding. These are '
  'not members: no account, no agreement, and the row is purged with their session at 30 days.';
