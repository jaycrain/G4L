-- 0058: proactive-outreach preferences (Nudge Impl Plan §2 + Dial 1/2, Decision EEE). One row per member — the
-- "member-controlled dial" from Governance §7b, made real: their chosen rhythm, quiet hours, channels. Defaults
-- lean to presence (few_week) per EEE; the in-Session rhythm-elicitation UI is a later slice. `ignored_streak`
-- drives the auto-back-off (consecutive ignored/dismissed → cadence decays toward a floor). Member-owned; cascades.
create table if not exists outreach_pref (
  member_id      uuid primary key references member_profile(member_id) on delete cascade,
  tenant_id      text not null default 'public',
  rhythm         text not null default 'few_week' check (rhythm in ('daily', 'few_week', 'weekly', 'on_ask')),
  quiet_start    int  not null default 21 check (quiet_start between 0 and 23),  -- local hour, inclusive
  quiet_end      int  not null default 7  check (quiet_end   between 0 and 23),  -- local hour, exclusive
  timezone       text,                                                          -- IANA (member local); null → safe default upstream
  channels       jsonb not null default '{"in_app": true}'::jsonb,              -- {in_app, email, sms, push}
  ignored_streak int  not null default 0,                                       -- consecutive ignored → back-off
  updated_at     timestamptz not null default now()
);

-- RLS: default-deny for the Data API roles; the app's owner connection bypasses it (same posture since 0039).
alter table outreach_pref enable row level security;
