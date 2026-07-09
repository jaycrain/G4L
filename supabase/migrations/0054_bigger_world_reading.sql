-- 0054: bigger_world_reading — the Reclaim C2 "Bigger World Audit" register. A four-domain (Physical/Self/Social/
-- Outlook) priority audit: five 1–10 ratings per domain → RC-1 priority scores + classification (Primary / Secondary
-- / Momentum Lever). Its own parallel register (sibling to motivation_reading/self_management_reading).
--
-- RC-4 (Greg): priorities must be retained + retrievable across cycles — the member can ask the Companion "show me my
-- past priorities." So this is longitudinal: sequence_no 0 = the first (v2.5) audit, then quarterly re-reads. NEVER
-- folded into Grinta (C4 is the Challenge component).
--
-- responses is self-describing ({ "BWA-physical-current": 6, ... } code→value, 1..10). priorities holds the computed
-- output ({ domains:[...], primary, secondary, momentumLever }) as jsonb — flexible so the classification can gain
-- fields (obstacle/first-action, deferred) without a migration.
--
-- Additive + idempotent. RLS enabled (owner-connection bypasses; default-deny for the Data API roles) — no policy,
-- same posture as 0047–0051. Applied by Jay on prod; staged-only (RECLAIM), nothing on prod v2.4 writes this yet.
create table if not exists bigger_world_reading (
  reading_id  uuid primary key default gen_random_uuid(),
  tenant_id   text not null default 'public',
  member_id   uuid not null references member_profile(member_id) on delete cascade,
  source      text not null,                 -- 'c2' (governed in config)
  sequence_no int  not null,                 -- 0 = first reading (v2.5), then 1, 2, ...
  taken_on    date not null default current_date,
  responses   jsonb not null,                -- { "BWA-physical-current": 6, ... } code→value (1..10)
  priorities  jsonb not null,                -- { domains:[...], primary, secondary, momentumLever }
  created_at  timestamptz not null default now(),
  constraint bigger_world_reading_unique_seq unique (member_id, source, sequence_no)
);
create index if not exists bigger_world_reading_member_idx on bigger_world_reading (member_id, taken_on desc);
alter table bigger_world_reading enable row level security;
