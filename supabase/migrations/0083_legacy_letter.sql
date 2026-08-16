-- 0083 — THE LEGACY LETTER. A letter the member writes to themselves, dated one year out.
--
-- Greg moved this from Reclaim into Reconnect R3 so a member leaves the first R holding a destination rather than
-- only a diagnosis. It never got built: he walked the product on 2026-08-04 and reported "I never really wrote
-- it", and Reclaim's Legacy-revisit beat has had nothing to revisit since it shipped.
--
-- ITS OWN TABLE, not a playbook_entry. A keeper is a line the Companion may reach for mid-conversation. This is a
-- document the MEMBER owns, in their first person, addressed to a date — and the whole design depends on it being
-- re-openable a year later and comparable against where they actually are. Greg: "The distance between what they
-- wrote and where they actually are becomes the most personal measuring stick in the entire program."
--
-- answers jsonb keeps the raw responses beside the composed letter on purpose. The letter is a MODEL DRAFT the
-- member then revises; if the draft is ever regenerated or the composer improves, their own words must still be
-- there to draft from again. Never keep only the derived artifact when the source was the member's.
--
-- PRIVATE BY DEFAULT (Greg): "Members are invited — never pressured — to share one sentence from it." shared_line
-- holds only the single sentence they chose to share, if they ever choose one. The letter itself never leaves.

create table if not exists legacy_letter (
  member_id    uuid        not null references member_profile(member_id) on delete cascade,
  body         text        not null,
  answers      jsonb       not null default '{}'::jsonb,
  dated_for    date        not null,
  shared_line  text,
  opened_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (member_id)
);

alter table legacy_letter enable row level security;
