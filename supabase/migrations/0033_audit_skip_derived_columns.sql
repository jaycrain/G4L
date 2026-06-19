-- 0033: Keep the member_profile audit (0032) signal, drop the noise. Some columns are high-churn,
-- machine-derived caches — not identity facts — and would write a fat audit row on nearly every
-- dashboard load or agent turn:
--   dashboard_snapshot / dashboard_snapshot_at  (recomputed each render)
--   agent_memory / agent_memory_seq             (the MA's rolling scratch memory)
--   playbook_synthesis                          (regenerated each Session close)
-- They're reconstructable and already have their own seq/timestamps; auditing them just bloats the
-- table. Replace the trigger function to skip them on UPDATE and strip them from create/delete
-- snapshots. Everything that matters for "who changed this account, and when" still logs:
-- display_name, email, named_door, identity_noun, identity_paragraph, reclaim_list, active, consent,
-- the once-per-member lifecycle flags, and the _created/_deleted events.

create or replace function audit_member_profile() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text := coalesce(nullif(current_setting('g4l.actor', true), ''), 'system');
  skip text[] := array['updated_at','dashboard_snapshot','dashboard_snapshot_at',
                       'agent_memory','agent_memory_seq','playbook_synthesis'];
  old_j jsonb;
  new_j jsonb;
  k text;
begin
  if tg_op = 'INSERT' then
    insert into member_profile_audit (tenant_id, member_id, field, old_value, new_value, changed_by)
    values (new.tenant_id, new.member_id, '_created', null, to_jsonb(new) - skip, actor);
    return new;

  elsif tg_op = 'DELETE' then
    insert into member_profile_audit (tenant_id, member_id, field, old_value, new_value, changed_by)
    values (old.tenant_id, old.member_id, '_deleted', to_jsonb(old) - skip, null, actor);
    return old;

  else -- UPDATE: one row per changed column, ignoring the derived/volatile ones
    old_j := to_jsonb(old) - skip;
    new_j := to_jsonb(new) - skip;
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
