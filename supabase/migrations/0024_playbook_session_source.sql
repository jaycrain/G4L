-- 0024: Sessions feed the Playbook. The Identity Excavation close harvests the member's own words
-- into their Playbook as proposals; allow 'session' as a source_kind provenance alongside the rest.
alter table playbook_entry drop constraint if exists playbook_entry_source_kind_check;
alter table playbook_entry
  add constraint playbook_entry_source_kind_check check (source_kind in ('beat','science','checkpoint','own','session'));
