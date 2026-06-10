-- 0014: Beat Engine — the Learning Strategy's content-as-Beats model (thin vertical slice).
-- Two new tables; both get RLS (0013's DO-loop already ran, so new tables need it explicitly).
--
-- reclaim_item — the Reclaim List as structured rows (was member_profile.reclaim_list jsonb).
-- Each item carries a CATEGORY = an IDQ dimension (physical|self|social|outlook), so a goal Beat
-- can bind to "the member's least-recently-served open item in this category" (Slice Spec Decisions
-- 1 & 2). State machine: not_yet → closer → reclaimed.
create table if not exists reclaim_item (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references member_profile(member_id) on delete cascade,
  text           text not null,
  category       text not null default 'self' check (category in ('physical','self','social','outlook')),
  rhythm         text not null default 'weekly' check (rhythm in ('daily','weekly','once')),
  state          text not null default 'not_yet' check (state in ('not_yet','closer','reclaimed')),
  closer_count   int  not null default 0,
  sort_order     int  not null default 0,           -- entry order; ties broken by this
  last_served_at timestamptz,                        -- for least-recently-served selection
  reclaimed_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists reclaim_item_member_idx on reclaim_item (member_id, sort_order);
alter table reclaim_item enable row level security;

-- beat_completion — one row per completed Beat + its close. Carries the Grinta component flags
-- (Slice Spec Decision 4): every completion feeds Consistency; a return-after-miss feeds Recovery;
-- a goal Beat closed "closer" (or a stretch/measuring-stick) feeds Reach.
create table if not exists beat_completion (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references member_profile(member_id) on delete cascade,
  beat_id           text not null,
  close_type        text not null check (close_type in ('goal','rep','reflect')),
  close_response    text,                              -- closer|not_yet|sideways | yes|no | reflect free-text
  reclaim_item_id   uuid references reclaim_item(id) on delete set null,  -- the served item (goal only)
  feeds_consistency boolean not null default true,
  feeds_recovery    boolean not null default false,
  feeds_reach       boolean not null default false,
  completed_at      timestamptz not null default now()
);
create index if not exists beat_completion_member_idx on beat_completion (member_id, completed_at);
alter table beat_completion enable row level security;

-- Backfill: existing members' jsonb Reclaim List → reclaim_item rows (default category 'self';
-- the demo personas only — real accounts were wiped). Idempotent.
insert into reclaim_item (member_id, text, category, rhythm, sort_order)
select p.member_id, elem.txt, 'self', 'weekly', (elem.ord - 1)::int
from member_profile p
cross join lateral jsonb_array_elements_text(p.reclaim_list) with ordinality as elem(txt, ord)
where p.reclaim_list is not null
  and jsonb_typeof(p.reclaim_list) = 'array'
  and not exists (select 1 from reclaim_item ri where ri.member_id = p.member_id);
