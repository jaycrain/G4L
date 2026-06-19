-- 0032: Wire the Layer 3 audit. member_profile_audit was scaffolded in 0001 but nothing ever wrote
-- to it — so a member account could be created or DELETED (incl. by an ad-hoc debug script) with no
-- record of when, how, or by whom. This is privacy-critical data; we need a forensic trail.
--
-- A DB-level trigger is deliberate: it captures EVERY change to member_profile regardless of code
-- path — the app, a migration, or someone at a psql console — which an app-layer helper cannot.
--
-- Shape (matches the table's per-field design):
--   * INSERT  -> one row, field '_created', new_value = full row snapshot (minus volatile updated_at)
--   * DELETE  -> one row, field '_deleted', old_value = full row snapshot
--   * UPDATE  -> one row per changed column (field = column name, old/new = the two values)
-- changed_by reads a per-transaction GUC `g4l.actor` when the app sets it (set local g4l.actor='member'),
-- else defaults to 'system'. SECURITY DEFINER + pinned search_path so the audit write is never blocked
-- by RLS or a hostile search_path.

-- 1) The audit must OUTLIVE the member row, so a deletion can be recorded. The inline FK from 0001
--    (member_id references member_profile) would block that — drop whatever FK sits on the column.
do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.member_profile_audit'::regclass
    and contype = 'f'
    and conkey = (
      select array_agg(attnum)
      from pg_attribute
      where attrelid = 'public.member_profile_audit'::regclass and attname = 'member_id'
    );
  if cname is not null then
    execute format('alter table public.member_profile_audit drop constraint %I', cname);
  end if;
end $$;

-- 2) The trigger function.
create or replace function audit_member_profile() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text := coalesce(nullif(current_setting('g4l.actor', true), ''), 'system');
  old_j jsonb;
  new_j jsonb;
  k text;
begin
  if tg_op = 'INSERT' then
    insert into member_profile_audit (tenant_id, member_id, field, old_value, new_value, changed_by)
    values (new.tenant_id, new.member_id, '_created', null, to_jsonb(new) - 'updated_at', actor);
    return new;

  elsif tg_op = 'DELETE' then
    insert into member_profile_audit (tenant_id, member_id, field, old_value, new_value, changed_by)
    values (old.tenant_id, old.member_id, '_deleted', to_jsonb(old) - 'updated_at', null, actor);
    return old;

  else -- UPDATE: one audit row per column that actually changed (ignore the updated_at touch)
    old_j := to_jsonb(old) - 'updated_at';
    new_j := to_jsonb(new) - 'updated_at';
    if old_j is distinct from new_j then
      for k in select jsonb_object_keys(new_j) loop
        if (old_j -> k) is distinct from (new_j -> k) then
          insert into member_profile_audit (tenant_id, member_id, field, old_value, new_value, changed_by)
          values (new.tenant_id, new.member_id, k, old_j -> k, new_j -> k, actor);
        end if;
      end loop;
    end if;
    return new;
  end if;
end;
$$;

-- 3) Fire on every lifecycle event. (Drop-then-create keeps the migration idempotent.)
drop trigger if exists member_profile_audit_ins on member_profile;
drop trigger if exists member_profile_audit_upd on member_profile;
drop trigger if exists member_profile_audit_del on member_profile;

create trigger member_profile_audit_ins after insert on member_profile
  for each row execute function audit_member_profile();
create trigger member_profile_audit_upd after update on member_profile
  for each row execute function audit_member_profile();
create trigger member_profile_audit_del after delete on member_profile
  for each row execute function audit_member_profile();
