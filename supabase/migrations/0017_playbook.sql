-- 0017: Your G4L Playbook — the member's synthesized record of what's working (see docs/playbook.md).
-- One table, the shared pipe for BOTH the MA-gathered keepers and the member's free-add journal.
-- RLS enabled explicitly (0013's DO-loop already ran, so new tables opt in here).
--
-- A playbook_entry is either:
--   • gathered  — MA-proposed (state proposed → kept | dismissed); the curated "cheat sheet" half.
--   • authored  — the member's own free-add (lands kept immediately); the journal half.
-- The three synthesized sections (what_works | why_works | own_words) hold kept keepers; the
-- journal section holds authored entries. Provenance is shown as a chip (source_label).
create table if not exists playbook_entry (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references member_profile(member_id) on delete cascade,
  section      text not null check (section in ('what_works','why_works','own_words','journal')),
  body         text not null,
  authorship   text not null check (authorship in ('gathered','authored')),
  state        text not null default 'proposed' check (state in ('proposed','kept','dismissed')),
  source_kind  text check (source_kind in ('beat','science','checkpoint','own')),  -- provenance
  source_ref   text,                                   -- beat_id / asset code / R, for linking back
  source_label text,                                   -- chip text, e.g. 'Rewire · Food as fuel'
  pinned       boolean not null default false,
  shared       boolean not null default false,         -- future member-initiated sharing (default off)
  sort_order   int     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists playbook_entry_member_idx on playbook_entry (member_id, section, sort_order);
alter table playbook_entry enable row level security;
