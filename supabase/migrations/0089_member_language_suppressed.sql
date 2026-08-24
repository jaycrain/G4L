-- 0089: member_language_suppressed — "don't use that" / "that's not accurate", made real.
--
-- The Companion is about to start quoting a member's own phrases back to her (member_language_history, Greg's
-- required input to seven assets). Jay's ruling on the obvious objection, 2026-08-23: she can say "don't use that"
-- or "that's not accurate" and it should be honoured "unimpeded conversationally".
--
-- THIS TABLE IS WHAT MAKES THAT SENTENCE TRUE. Without it we would be repeating the exact fault fixed earlier the
-- same day: the Legacy Letter told members "change it whenever it stops being true" for as long as the feature had
-- existed, with no way to change it. A promise the product cannot keep is worse than a feature it never shipped —
-- and it would be worse HERE, because the thing she is objecting to is us quoting her.
--
-- NORMALISED TEXT, NOT AN ID, and that is deliberate. The same sentence can exist as a keeper AND as a Reclaim
-- item; she is not asking us to stop using one row, she is asking us to stop using a thing she said. Matching on
-- normalised text suppresses it everywhere it appears, including anywhere it gets copied to later.
--
-- phrase_seen KEEPS HER ORIGINAL, capped. Not for display — for us, when someone asks in three months WHY a phrase
-- stopped being used. A normalised hash with no readable trace is unauditable, and this is member data with a
-- member decision attached.
--
-- NO REASON COLUMN, ON PURPOSE. She is not making a case and we are not assessing one. Asking why she wants a
-- phrase dropped turns a boundary into a negotiation, which is the opposite of "unimpeded".
--
-- SOFT BY NATURE: nothing is deleted from playbook_entry or reclaim_item. She has asked us to stop QUOTING it, not
-- to erase it from her Playbook — those are different acts, and conflating them would delete something she chose
-- to keep.
--
-- Additive + idempotent. RLS enabled, no policy — owner-connection bypasses, default-deny for the Data API roles
-- (the posture of 0049–0055, 0072, 0074, 0084).

create table if not exists member_language_suppressed (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    text not null default 'public',
  member_id    uuid not null references member_profile(member_id) on delete cascade,
  -- lower-cased, whitespace-collapsed, punctuation-stripped. See normalise() in lib/member/language-history.ts —
  -- the two MUST agree, and a test pins that they do.
  phrase_norm  text not null,
  -- What she actually said, capped. An audit trail, never rendered.
  phrase_seen  text,
  created_at   timestamptz not null default now()
);

-- One row per member per phrase. Saying "don't use that" twice is not two decisions.
create unique index if not exists member_language_suppressed_member_phrase
  on member_language_suppressed (member_id, phrase_norm);

alter table member_language_suppressed enable row level security;

comment on table member_language_suppressed is
  'Phrases the member has asked the Companion to stop quoting back. Soft: nothing is deleted from her Playbook.';
