-- ============================================================================
-- G4L Platform — Migration 0003: Founder Agent drafts
-- The Founder Agent drafts Member-facing correspondence in Jay's voice. It is
-- operator-side; members never interact with it. Every draft is reviewed by Jay
-- before it sends — the agent has no send path (Founder Agent Tech Spec v1.0;
-- AI Governance Framework: "Founder Agent: no auto-send"). This table is Layer 5
-- (Draft Output) — the review queue + send history.
-- Multi-tenant: tenant_id present, RLS dormant (per 0001).
-- ============================================================================

create table founder_agent_drafts (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        text not null default 'public',
  member_id        uuid not null references member_profile(member_id),
  operating_moment text not null,          -- post_idq_welcome | retake_commentary | milestone_commentary | false_start_return | cycle2_welcome
  channel          text not null default 'email' check (channel in ('email','sms')),
  triggered_at     timestamptz not null default now(),
  drafted_at       timestamptz not null default now(),
  input_snapshot   jsonb not null default '{}'::jsonb,  -- member context the draft was grounded in
  draft_subject    text not null,
  draft_body       text not null,
  jay_edits        text,                    -- Jay's edited body, if revised before sending
  approval_status  text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  approved_at      timestamptz,
  sent_at          timestamptz,
  hubspot_email_id text,                    -- set when actually sent via HubSpot (later)
  created_at       timestamptz not null default now()
);
create index founder_drafts_queue_idx  on founder_agent_drafts (approval_status, drafted_at desc);
create index founder_drafts_member_idx on founder_agent_drafts (member_id, drafted_at desc);
