-- 0059: proactive-outreach log — one row per outreach the engine produced, in any state (ready → sent → dismissed
-- /replied, or held). Backs three things: the §8 provenance rule (a check makes provenance MANDATORY for anything
-- not held — no ungrounded message can be recorded as ready/sent), the no-double-nudge + weekly-ceiling cadence
-- reads, and the backpressure signal (ignored → auto-lower). Member-owned; cascades on delete.
create table if not exists outreach_log (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    text not null default 'public',
  member_id    uuid not null references member_profile(member_id) on delete cascade,
  trigger      text not null,
  tense        text not null check (tense in ('present', 'practice', 'horizon')),
  channel      text not null default 'in_app',                                              -- in_app|email|sms|push
  status       text not null check (status in ('ready', 'held', 'sent', 'dismissed', 'replied')),
  message      text,                                                                        -- the member-facing text (null when held)
  provenance   jsonb,                                                                       -- §8 citation: {stream, ref, quote}
  hold_reason  text,                                                                        -- validator/cadence failure(s), when held
  created_at   timestamptz not null default now(),
  responded_at timestamptz,                                                                 -- when dismissed/replied
  -- §8 hard rule at the DB level: only a HELD row may lack provenance; anything shown/sent must cite its source.
  constraint outreach_grounded check (status = 'held' or provenance is not null)
);
create index if not exists outreach_log_member_idx on outreach_log (member_id, created_at desc);

alter table outreach_log enable row level security;
