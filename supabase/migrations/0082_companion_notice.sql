-- 0082 — RAISE ONCE. What the Companion has already pointed out, so it never points it out twice.
--
-- lib/agent/disconnection.ts computes, deterministically, when a fact we hold about a member does not connect to
-- what they said they want (their weakest area with no goal in it; an identity they named that nothing on their
-- list is about; a commitment that serves nothing). The Companion raises it ONCE, in their words. Their answer —
-- including "no, that's fine" — settles it permanently.
--
-- Without this table there is no memory of having asked, and the same observation would resurface every session,
-- which is precisely how a companion becomes a nag. This surface's entire value is that it is safe to be honest;
-- a member who expects to be asked the same question forever stops giving true answers.
--
-- KEYED ON (kind, subject), NOT JUST kind. If her list changes later and a genuinely DIFFERENT area falls bare,
-- that is a new observation and should be sayable. Only the settled one stays settled.

create table if not exists companion_notice (
  member_id  uuid        not null references member_profile(member_id) on delete cascade,
  kind       text        not null check (kind in ('identity','dimension','commitment')),
  subject    text        not null,
  raised_at  timestamptz not null default now(),
  primary key (member_id, kind, subject)
);

create index if not exists companion_notice_member_idx on companion_notice (member_id);

alter table companion_notice enable row level security;
