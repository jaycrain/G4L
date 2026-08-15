-- 0079: Finish the member-data audit trail — add playbook_entry to it.
--
-- WHY THIS IS URGENT RATHER THAN TIDY (Jay, 2026-08-15). A charter member asked for "a report on how everything
-- I entered in the Playbook is going, week to week." We cannot answer that, and not for want of data elsewhere:
-- practice marks are dated per day, Quality Days are one row per day, every assessment reading is a dated
-- snapshot, and reclaim_item / member_door / member_profile already have this trigger (0041 / 0043 / 0032).
--
-- playbook_entry was the one that never got it, and it is the table that MUTATES:
--
--     update playbook_entry set state=$3, updated_at=now() where ...
--
-- A Move kept on the 3rd and dropped on the 11th leaves only `state=dismissed, updated_at=<the 11th>`. That it
-- was ever kept, and for how long, is simply gone — and gone in the only direction that matters, since the
-- member's own arc ("I kept this, I ran it, I let it go") is the story the report is supposed to tell.
--
-- Same shape as the Quality-Days bug found the same morning: a replacing write, silently lossy, unrecoverable
-- after the fact. Which is the argument for doing it FIRST rather than alongside the reporting work — every day
-- without it is a day of history no later feature can reconstruct.
--
-- A DB trigger, not an app-layer helper, for the reason 0032 and 0041 give: it captures EVERY change regardless
-- of code path. The Companion edits this table, the member edits it from the rail, and sessions write keepers
-- into it; a helper would have to be remembered at each site, and the one that forgets is invisible.
--
-- EXCLUDED FROM UPDATE DIFFS: updated_at only (it changes on every write and would double every row), exactly
-- as 0032 does. sort_order is deliberately KEPT — it is assigned once at insert (max+1) and nothing bulk-rewrites
-- it, so it cannot flood, and a pin/reorder is a real member act worth seeing.

create or replace function audit_playbook_entry() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text := coalesce(nullif(current_setting('g4l.actor', true), ''), 'system');
  ten   text;
  old_j jsonb;
  new_j jsonb;
  k     text;
begin
  if tg_op = 'INSERT' then
    ten := coalesce((select tenant_id from member_profile where member_id = new.member_id), 'public');
    insert into member_profile_audit (tenant_id, member_id, source, field, old_value, new_value, changed_by)
    values (ten, new.member_id, 'playbook_entry', '_created', null, to_jsonb(new), actor);
    return new;

  elsif tg_op = 'DELETE' then
    ten := coalesce((select tenant_id from member_profile where member_id = old.member_id), 'public');
    insert into member_profile_audit (tenant_id, member_id, source, field, old_value, new_value, changed_by)
    values (ten, old.member_id, 'playbook_entry', '_deleted', to_jsonb(old), null, actor);
    return old;

  else -- UPDATE: one row per changed column, so state / pinned / body each read as their own event
    ten := coalesce((select tenant_id from member_profile where member_id = new.member_id), 'public');
    old_j := to_jsonb(old) - 'updated_at';
    new_j := to_jsonb(new) - 'updated_at';
    if old_j is distinct from new_j then
      for k in select jsonb_object_keys(new_j) loop
        if (old_j -> k) is distinct from (new_j -> k) then
          insert into member_profile_audit (tenant_id, member_id, source, field, old_value, new_value, changed_by)
          values (ten, new.member_id, 'playbook_entry', k, old_j -> k, new_j -> k, actor);
        end if;
      end loop;
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists playbook_entry_audit_ins on playbook_entry;
drop trigger if exists playbook_entry_audit_upd on playbook_entry;
drop trigger if exists playbook_entry_audit_del on playbook_entry;

create trigger playbook_entry_audit_ins after insert on playbook_entry
  for each row execute function audit_playbook_entry();
create trigger playbook_entry_audit_upd after update on playbook_entry
  for each row execute function audit_playbook_entry();
create trigger playbook_entry_audit_del after delete on playbook_entry
  for each row execute function audit_playbook_entry();
