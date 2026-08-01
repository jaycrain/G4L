-- 0066: the Founder Console conversation, durable across devices.
--
-- Jay checks the console from a bike ride, then a desk. Until now the thread lived in sessionStorage and died
-- with the tab, so the answer he got this morning was gone by the afternoon.
--
-- ── WHY THIS TABLE IS NOT LIKE THE OTHERS ──────────────────────────────────────────────────────────────────
-- When he asks about ONE member, the reply can legitimately contain that member's own words — their gap, their
-- Reclaim List. So this is a SECOND COPY of the most sensitive text in the product, in a table the member never
-- consented to and cannot see. It exists because Jay decided the operator continuity is worth it (2026-08-01) —
-- and it carries the two controls that decision was made WITH, not as extras:
--
--   1. RETENTION. Pruned to 30 days on write. Operator continuity is a days-to-weeks need; a permanent archive
--      of conversations about members is a different thing nobody asked for.
--   2. PURGE. "Clear this conversation" deletes the rows, not just the screen. Already the behaviour of the
--      session-storage version; it stays true now that there is a server side.
--
-- The member's OWN record is untouched by all of this — it remains the source of truth and is unaffected by a
-- purge here.

create table if not exists founder_message (
  id         bigserial primary key,
  -- Not a member_id: this is the OPERATOR's thread. Single-operator today; the column exists so a second
  -- console user doesn't require a migration and can never read the first one's conversation by accident.
  operator   text not null default 'jay',
  role       text not null check (role in ('jay', 'companion')),
  text       text not null,
  looked     jsonb not null default '[]'::jsonb,   -- which tools the answer used, for the "Checked …" receipt
  created_at timestamptz not null default now()
);

create index if not exists founder_message_idx on founder_message (operator, created_at desc);

alter table founder_message enable row level security;
-- No policies: the owner connection bypasses RLS and nothing member-facing reads this. Enabling it keeps the
-- "RLS on by default" sweep (0039/0042) honest.
