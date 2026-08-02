-- 0070: which theme the console wears.
--
-- The console shipped dark (Jay: "more of a contrast between the Member App and the Founder Console"), and on
-- seeing it he asked to keep light as an option — "Maybe it should be the dark theme and I would like the
-- option to switching back". Dark is the default; light is one tap away.
--
-- ON founder_state RATHER THAN A COOKIE, so the choice follows the PERSON across a MacBook, an iPad and a
-- phone — the same reason the activity marker lives here. A cookie would have avoided this migration, but it
-- would also mean the console could be dark on one device and light on another, which is exactly the small
-- inconsistency that nags.
--
-- Server-read, so the ground is right in the FIRST paint. A localStorage theme flashes the wrong one while
-- the page hydrates, and a flash of white on a surface chosen for being dark is worse than no option at all.

alter table founder_state add column if not exists theme text not null default 'dark'
  check (theme in ('dark', 'light'));
