-- 0037: Connect notifications — "someone replied to / cheered your post". In-app for now: the member
-- sees them on Connect, with an unread count on the dashboard panel. Push/email + the Member Agent
-- surfacing them ("someone replied to what you shared") come later. Design: docs/connect-design.md.
create table if not exists connect_notification (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references member_profile(member_id) on delete cascade, -- recipient
  kind       text not null check (kind in ('reply', 'cheer')),
  actor_id   uuid not null references member_profile(member_id) on delete cascade, -- who did it
  post_id    uuid not null references connect_post(id) on delete cascade,
  reply_id   uuid references connect_reply(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists connect_notification_inbox_idx
  on connect_notification (member_id, read_at, created_at desc);

alter table connect_notification enable row level security;
