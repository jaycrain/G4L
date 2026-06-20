-- 0035: Connect — the community feature (Reconnect → Connect with others). Phase 1, async-first:
-- Share + Topics (+replies) + reactions + accountability + the trust-&-safety primitives. Live-now
-- (real-time presence / rooms) is Phase 2 and not created here. Member-created groups are Phase 1.5,
-- anticipated via a nullable connect_post.group_id (no groups table yet).
--
-- Isolation follows the app-wide model (see 0013): RLS ENABLED on every table, NO policies — the
-- app's owner connection bypasses RLS and authorizeMember enforces access in app code. Multi-tenant
-- org columns land app-wide at switch-on under senior review, deliberately NOT bolted onto Connect
-- alone. Design + intent: docs/connect-design.md. Data model / RLS want a senior-engineer pass.

-- Identity: a member is pseudonymous to peers (handle) but always identified to the platform.
create table if not exists connect_profile (
  member_id      uuid primary key references member_profile(member_id) on delete cascade,
  handle         text not null,
  reveal_default boolean not null default false,  -- default for NEW posts: false = handle, true = real name
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists connect_profile_handle_uniq on connect_profile (lower(handle));

-- Posts: the global feed. A "share" and a "topic" are the same row — a topic is just a post that draws
-- replies. show_name captures the author's reveal choice AT POST TIME, so revealing a real name can be
-- applied forward (new posts) or retroactively (update past rows) and reversed — per-post control.
create table if not exists connect_post (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid not null references member_profile(member_id) on delete cascade,
  group_id         uuid,                                 -- null in v1 (global feed); Phase 1.5 groups
  title            text,                                 -- optional (topics may carry one)
  body             text not null,
  reclaim_item_id  uuid references reclaim_item(id) on delete set null,  -- ties a post to a Reclaim item
  category         text check (category in ('physical','self','social','outlook')),  -- optional IDQ tag
  show_name        boolean not null default false,       -- reveal choice for THIS post
  status           text not null default 'visible' check (status in ('visible','hidden','removed')),
  created_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now()    -- bumped on new reply (app-maintained)
);
create index if not exists connect_post_feed_idx on connect_post (status, last_activity_at desc);
create index if not exists connect_post_author_idx on connect_post (author_id);
create index if not exists connect_post_group_idx on connect_post (group_id) where group_id is not null;

create table if not exists connect_reply (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references connect_post(id) on delete cascade,
  author_id  uuid not null references member_profile(member_id) on delete cascade,
  body       text not null,
  show_name  boolean not null default false,
  status     text not null default 'visible' check (status in ('visible','hidden','removed')),
  created_at timestamptz not null default now()
);
create index if not exists connect_reply_post_idx on connect_reply (post_id, created_at);

-- Reactions: the "inspire / cheer" signal. One per (member, target, kind).
create table if not exists connect_reaction (
  id          uuid primary key default gen_random_uuid(),
  target_kind text not null check (target_kind in ('post','reply')),
  target_id   uuid not null,
  member_id   uuid not null references member_profile(member_id) on delete cascade,
  kind        text not null default 'cheer',
  created_at  timestamptz not null default now(),
  unique (target_kind, target_id, member_id, kind)
);
create index if not exists connect_reaction_target_idx on connect_reaction (target_kind, target_id);

-- Accountability: a pact has a doer (commits) and a partner (holds them to it). The viewer sees both
-- the pacts they made (doer_id = me) and the ones they hold for someone (partner_id = me).
create table if not exists connect_pact (
  id              uuid primary key default gen_random_uuid(),
  doer_id         uuid not null references member_profile(member_id) on delete cascade,
  partner_id      uuid not null references member_profile(member_id) on delete cascade,
  commitment      text not null,
  reclaim_item_id uuid references reclaim_item(id) on delete set null,
  cadence         text,                                  -- free text, e.g. "twice this week"
  status          text not null default 'active' check (status in ('active','kept','ended')),
  created_at      timestamptz not null default now()
);
create index if not exists connect_pact_doer_idx on connect_pact (doer_id, status);
create index if not exists connect_pact_partner_idx on connect_pact (partner_id, status);

create table if not exists connect_pact_checkin (
  id         uuid primary key default gen_random_uuid(),
  pact_id    uuid not null references connect_pact(id) on delete cascade,
  member_id  uuid not null references member_profile(member_id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists connect_pact_checkin_pact_idx on connect_pact_checkin (pact_id, created_at);

-- Trust & safety: reports (with a fast-path "worried about them" flag) and blocks.
create table if not exists connect_report (
  id                 uuid primary key default gen_random_uuid(),
  reporter_id        uuid not null references member_profile(member_id) on delete cascade,
  subject_kind       text not null check (subject_kind in ('post','reply','member')),
  subject_id         uuid not null,
  reason             text,
  concern_for_safety boolean not null default false,     -- "I'm worried about them" → jumps the queue
  status             text not null default 'open' check (status in ('open','reviewed','actioned')),
  reviewed_by        uuid references member_profile(member_id) on delete set null,
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists connect_report_queue_idx on connect_report (status, concern_for_safety desc, created_at);

create table if not exists connect_block (
  member_id         uuid not null references member_profile(member_id) on delete cascade,
  blocked_member_id uuid not null references member_profile(member_id) on delete cascade,
  created_at        timestamptz not null default now(),
  primary key (member_id, blocked_member_id)
);

-- RLS: enable on every new table, no policies (matches 0013 — owner connection bypasses; app-layer
-- authorizeMember is the access control). New tables don't inherit 0013's one-time loop, so enable here.
alter table connect_profile      enable row level security;
alter table connect_post         enable row level security;
alter table connect_reply        enable row level security;
alter table connect_reaction     enable row level security;
alter table connect_pact         enable row level security;
alter table connect_pact_checkin enable row level security;
alter table connect_report       enable row level security;
alter table connect_block        enable row level security;
