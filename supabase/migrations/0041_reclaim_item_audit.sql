-- 0041: Consolidate the member-data audit trail — add reclaim_item to it.
--
-- member_profile changes are already audited by a DB trigger (0032) into member_profile_audit. Reclaim
-- List items live in their own table (reclaim_item), so member-initiated edits (add / remove / reorder /
-- refine / mark) skipped that trail. The Companion can now edit the Reclaim List through conversation
-- (handoff 2026-06-25), so — for a platform where the audit trail matters — every member-data mutation
-- should land in ONE reviewable log. A DB trigger captures EVERY change regardless of code path, exactly
-- like 0032 (an app-layer helper can't).
--
-- Approach: add a `source` discriminator to the existing audit table (member_profile rows default to
-- 'member_profile'; the existing trigger is untouched and just inherits the default), then trigger
-- reclaim_item into the same table with source='reclaim_item'. last_served_at (operational churn from
-- beat-serving) is excluded from UPDATE diffs so it never floods the log — same idea as 0032 dropping
-- updated_at. The soft-remove (a removed_at stamp) lands here as an UPDATE row, field='removed_at'.

alter table member_profile_audit add column if not exists source text not null default 'member_profile';

create or replace function audit_reclaim_item() returns trigger
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
    values (ten, new.member_id, 'reclaim_item', '_created', null, to_jsonb(new), actor);
    return new;

  elsif tg_op = 'DELETE' then
    ten := coalesce((select tenant_id from member_profile where member_id = old.member_id), 'public');
    insert into member_profile_audit (tenant_id, member_id, source, field, old_value, new_value, changed_by)
    values (ten, old.member_id, 'reclaim_item', '_deleted', to_jsonb(old), null, actor);
    return old;

  else -- UPDATE: one row per changed column; ignore the volatile last_served_at churn
    ten := coalesce((select tenant_id from member_profile where member_id = new.member_id), 'public');
    old_j := to_jsonb(old) - 'last_served_at';
    new_j := to_jsonb(new) - 'last_served_at';
    if old_j is distinct from new_j then
      for k in select jsonb_object_keys(new_j) loop
        if (old_j -> k) is distinct from (new_j -> k) then
          insert into member_profile_audit (tenant_id, member_id, source, field, old_value, new_value, changed_by)
          values (ten, new.member_id, 'reclaim_item', k, old_j -> k, new_j -> k, actor);
        end if;
      end loop;
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists reclaim_item_audit_ins on reclaim_item;
drop trigger if exists reclaim_item_audit_upd on reclaim_item;
drop trigger if exists reclaim_item_audit_del on reclaim_item;

create trigger reclaim_item_audit_ins after insert on reclaim_item
  for each row execute function audit_reclaim_item();
create trigger reclaim_item_audit_upd after update on reclaim_item
  for each row execute function audit_reclaim_item();
create trigger reclaim_item_audit_del after delete on reclaim_item
  for each row execute function audit_reclaim_item();
