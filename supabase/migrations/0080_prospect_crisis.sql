-- A PERSON IN CRISIS DURING ONBOARDING REACHED NO HUMAN (2026-08-15).
--
-- escalateCrisis records into member_event and emails an operator. It takes a member_id. During onboarding there
-- is no member — the row is created only at the final "This is me" tap — so the call was never wired, and the
-- CrisisSurface type has listed 'onboarding' as a valid surface the whole time with nothing behind it.
--
-- The member-facing half always worked: detectCrisis fires, 988 is delivered. It is the escalation that was
-- missing, on the one surface where it matters most. A person disclosing that they want to stop existing is most
-- likely to be doing it in their FIRST conversation, before they have an account — which is precisely the
-- conversation nobody was watching.
--
-- WHY A COLUMN AND NOT A TABLE. Everything an operator needs to act is already on this row (the email, the
-- transcript, the stage). All that was missing is "this one is urgent". A flag here inherits the 30-day purge in
-- purge_expired_auth() for free, so a prospect's crisis record cannot outlive the prospect's data — which a
-- separate table would have quietly done unless someone remembered to purge it too.
alter table onboarding_session add column if not exists crisis_flagged_at timestamptz;

comment on column onboarding_session.crisis_flagged_at is
  'Set when detectCrisis fired during onboarding. Drives the 6h alert dedupe and the operator console. Purged '
  'with the row at 30 days — a non-member''s crisis record must not outlive their data.';

-- Partial index: the console asks "any flagged prospects?", which is a tiny slice of a table that is itself
-- mostly abandoned rows. Indexing only the flagged ones keeps that read cheap without carrying the rest.
create index if not exists onboarding_session_crisis_idx
  on onboarding_session (crisis_flagged_at desc)
  where crisis_flagged_at is not null;
