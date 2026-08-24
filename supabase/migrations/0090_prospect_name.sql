-- THE NAME WE ALREADY ASKED FOR AND THEN THREW AWAY.
--
-- The signup gate collects a name and an email. The email became the session key; the name was written to
-- localStorage (chat.tsx, Decision Z: "remember so a return visit pre-fills name + email") and never left the
-- browser. So the console could only ever offer an operator an address — and for the one surface whose whole
-- job is deciding whether to reach out to a person who did not finish, an address is most of the value missing.
--
-- It rides on onboarding_session rather than anywhere durable ON PURPOSE. This is a name belonging to someone
-- who is NOT a member: they may have walked away, or been turned away at the scope gate, and they never agreed
-- to be kept. Holding it here means purge_expired_auth() takes it with the row at 30 days, and the commit
-- deletes it outright the moment they become a member (member_profile owns the name from then on). The name
-- cannot outlive the conversation that collected it.
--
-- Nullable with no backfill: every prospect already in the table stays name-less, which is honest. There is
-- nowhere to recover it from — it was only ever on their device.

alter table onboarding_session add column if not exists display_name text;

comment on column onboarding_session.display_name is
  'The name typed at the signup gate. Not a member; purged with the row at 30 days.';
