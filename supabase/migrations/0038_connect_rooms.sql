-- 0038: Connect Live now (Phase 2) — live rooms with PERSISTED messages. Persisted (not ephemeral)
-- on purpose: it's what makes live chat moderatable + crisis-routable in a vulnerable community.
-- Phase 2a delivers the rooms + messages + safety with polling; 2b swaps polling for Supabase
-- Realtime. Design: docs/connect-design.md.
create table if not exists connect_room (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  created_by       uuid not null references member_profile(member_id) on delete cascade,
  status           text not null default 'open' check (status in ('open', 'closed')),
  created_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index if not exists connect_room_open_idx on connect_room (status, last_activity_at desc);

create table if not exists connect_room_message (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references connect_room(id) on delete cascade,
  author_id  uuid not null references member_profile(member_id) on delete cascade,
  body       text not null,
  show_name  boolean not null default false,
  status     text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now()
);
create index if not exists connect_room_message_idx on connect_room_message (room_id, created_at);

-- Room messages join the same moderation queue (report + crisis flag) as posts/replies.
alter table connect_report drop constraint if exists connect_report_subject_kind_check;
alter table connect_report add constraint connect_report_subject_kind_check
  check (subject_kind in ('post', 'reply', 'member', 'room_message'));

alter table connect_room         enable row level security;
alter table connect_room_message enable row level security;
