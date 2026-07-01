-- 0046: Harvest keeper fields on playbook_entry (v2.1 Increment 4 — the frozen Harvest Event Contract v1.0).
-- A "keeper" is committed as a playbook_entry, reusing its proposed→kept lifecycle + the stubbed `shared` flag.
-- Two additive, nullable fields:
--   keeper_type — the harvest taxonomy (lights_you_up | tell | recovery_move | definition | principle). The
--                 ARTIFACT value is authoritative (the event's meta.keeperType is only intent-at-capture). FREE
--                 TEXT, NOT a DB check-constraint (the 0019/0024 tax) — the taxonomy is governed in registry/
--                 config. Nullable: authored / journal entries carry no keeper_type; only gathered keepers do.
--   moment_id   — correlation id joining this keeper to its immutable harvest_moment event (member_event.meta).
-- The legacy `section` axis is retained for back-compat (the full section→keeperType fold lands later). Additive,
-- idempotent, v1-safe (nothing writes these yet on prod).
alter table playbook_entry add column if not exists keeper_type text;
alter table playbook_entry add column if not exists moment_id   uuid;
create index if not exists playbook_entry_moment_idx on playbook_entry (moment_id) where moment_id is not null;
comment on column playbook_entry.keeper_type is
  'lights_you_up | tell | recovery_move | definition | principle — governed in registry/config, never a DB check';
