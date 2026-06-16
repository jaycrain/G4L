-- 0029: Charter feedback — an in-product channel for members (and operators) to log issues,
-- questions, and suggestions during testing. Deliberately SEPARATE from the Member Agent, whose
-- reflective-companion role is never turned into a helpdesk. Member-initiated product QI.
-- Member data behind the wall — RLS on (app connects as owner, bypasses RLS; Data API default-denied).
create table if not exists member_feedback (
  id          uuid primary key default gen_random_uuid(),
  -- set null (not cascade): a tester's reports outlive wiping their account. `author` keeps it
  -- attributable, and a null member_id also lets an operator (Jay) file without a member account.
  member_id   uuid references member_profile(member_id) on delete set null,
  author      text,                       -- name/email snapshot at file time (survives a wipe)
  kind        text not null check (kind in ('issue','question','suggestion')),
  body        text not null,
  surface     text,                       -- the route they were on (e.g. /session/<id>/RWR-VIS)
  context     jsonb not null default '{}'::jsonb,  -- { path, recentEvents:[…last ~10 member_event…] }
  status      text not null default 'new' check (status in ('new','triaged','resolved')),
  admin_note  text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists member_feedback_status_idx on member_feedback (status, created_at desc);
alter table member_feedback enable row level security;
