-- 0010: Member Agent conversation memory. Persists the check-in thread per member so the
-- companion picks up where you left off across sessions. Sensitive member content — isolated
-- at the app layer (authorizeMember); consent + retention handling is Path B before real members.
create table if not exists agent_message (
  id uuid primary key default gen_random_uuid(),
  seq bigserial,                  -- monotonic insertion order (timestamps can tie within a ms)
  member_id uuid not null references member_profile(member_id) on delete cascade,
  role text not null check (role in ('member','agent')),
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists agent_message_member_idx on agent_message (member_id, seq);
