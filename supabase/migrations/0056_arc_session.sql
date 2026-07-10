-- 0056: arc_session — per-turn save/resume for the phase arcs (Reconnect first; reusable for Rewire/Rebuild/Reclaim).
-- The phase-arc conversations were held CLIENT-side only, so a refresh / crash / navigation mid-session lost the
-- in-progress excavation (W-15) — worst for Reconnect's Doors work, the deepest, most emotionally heavy arc. This
-- persists the working state + transcript per (member, arc) so a session resumes exactly where it left off instead of
-- vanishing. Transient working state: cleared when the arc completes (its committed artifacts — door revisions, the
-- IDQ/grit readings — persist on their own as they cross). Post-onboarding, so an account already exists: keyed by
-- member_id (no per-device resume token needed — ownership/RLS already scopes it to the member).
--
-- Additive + idempotent. RLS enabled (owner-connection bypasses; default-deny for the Data API roles) — no policy,
-- same posture as 0049–0055. Applied by Jay on prod; staged-only arcs write it (nothing on prod that isn't flagged).
create table if not exists arc_session (
  member_id  uuid not null references member_profile(member_id) on delete cascade,
  arc        text not null,               -- 'reconnect' | 'rewire' | 'rebuild' | 'reclaim' (+ session variant if needed)
  state      jsonb not null,
  messages   jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (member_id, arc)
);
alter table arc_session enable row level security;
