-- 0043: Doors as a member-owned, revisable capture — bring member_door to reclaim_item (0040/0041) parity.
-- The Fade's Door(s) get REVISED as trust compounds (widen / correct / name — Depth Arch §5a): the member,
-- Companion-mediated, can add a Door, reprioritize which is primary, or set one aside. So member_door needs the
-- same recovery-first, audited, SOFT-DELETE posture as reclaim_item — never a raw delete, every change preserved
-- (the shift itself is meaningful; routing follows the current, the trail keeps the journey). Additive +
-- idempotent; v1-safe (nothing writes removed_at / cycle yet, and the audit trigger only records).

-- Soft-delete (a set-aside Door is stamped, never hard-deleted) + cycle-awareness (a Door set can differ by cycle).
alter table member_door add column if not exists removed_at      timestamptz;
alter table member_door add column if not exists cycle_indicator  int not null default 1;
create index if not exists member_door_active_idx on member_door (member_id, sort_order) where removed_at is null;

-- Per-table audit into the shared member_profile_audit (source='member_door') — mirrors audit_reclaim_item (0041):
-- one audit row per changed column on UPDATE, plus _created / _deleted markers. Actor from the g4l.actor GUC.
create or replace function audit_member_door() returns trigger
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
    values (ten, new.member_id, 'member_door', '_created', null, to_jsonb(new), actor);
    return new;

  elsif tg_op = 'DELETE' then
    ten := coalesce((select tenant_id from member_profile where member_id = old.member_id), 'public');
    insert into member_profile_audit (tenant_id, member_id, source, field, old_value, new_value, changed_by)
    values (ten, old.member_id, 'member_door', '_deleted', to_jsonb(old), null, actor);
    return old;

  else -- UPDATE: one row per changed column
    ten := coalesce((select tenant_id from member_profile where member_id = new.member_id), 'public');
    old_j := to_jsonb(old);
    new_j := to_jsonb(new);
    if old_j is distinct from new_j then
      for k in select jsonb_object_keys(new_j) loop
        if (old_j -> k) is distinct from (new_j -> k) then
          insert into member_profile_audit (tenant_id, member_id, source, field, old_value, new_value, changed_by)
          values (ten, new.member_id, 'member_door', k, old_j -> k, new_j -> k, actor);
        end if;
      end loop;
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists member_door_audit_ins on member_door;
drop trigger if exists member_door_audit_upd on member_door;
drop trigger if exists member_door_audit_del on member_door;
create trigger member_door_audit_ins after insert on member_door
  for each row execute function audit_member_door();
create trigger member_door_audit_upd after update on member_door
  for each row execute function audit_member_door();
create trigger member_door_audit_del after delete on member_door
  for each row execute function audit_member_door();
