-- 0069: per-operator console state — starting with "what have I already seen?"
--
-- Jay works from a MacBook, an iPad and an iPhone and wants Activity to show what's landed since he last
-- looked (2026-08-01). That only works if the marker follows the PERSON, not the browser — a per-device
-- timestamp would show him the same seven events three times, or hide them after the first device.
--
-- A key/value-ish row per operator rather than a single-purpose table: this is the first piece of console
-- state, it will not be the last, and a table per preference is how you end up with nine of them.

create table if not exists founder_state (
  operator          text primary key default 'jay',
  activity_seen_at  timestamptz,   -- null = never looked; the feed then shows everything as new, which is true
  updated_at        timestamptz not null default now()
);

alter table founder_state enable row level security;
-- No policies: owner connection bypasses RLS, nothing member-facing reads this.
