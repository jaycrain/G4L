-- 0006: Web Push subscriptions. One row per (member, device/browser) endpoint. A member can
-- have several (phone + laptop). Endpoints expire; dead ones are pruned on send.
create table if not exists push_subscription (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references member_profile(member_id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscription_member_idx on push_subscription (member_id);
