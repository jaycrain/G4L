-- Migration drift: which repo migrations are applied on this database?
-- 'applied=false' rows are MISSING from this DB (run them, in order).
select migration, applied
from (
  select '0001' as migration, coalesce(to_regclass('public.door') is not null, false) as applied
  union all
  select '0002' as migration, coalesce(to_regclass('public.asset_completion') is not null, false) as applied
  union all
  select '0003' as migration, coalesce(to_regclass('public.founder_agent_drafts') is not null, false) as applied
  union all
  select '0004' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_profile' and column_name='avatar_url'), false) as applied
  union all
  select '0005' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='founder_agent_drafts' and column_name='trigger_key'), false) as applied
  union all
  select '0006' as migration, coalesce(to_regclass('public.push_subscription') is not null, false) as applied
  union all
  select '0007' as migration, coalesce(to_regclass('public.activity_event') is not null, false) as applied
  union all
  select '0008' as migration, coalesce(to_regclass('public.nudge_log') is not null, false) as applied
  union all
  select '0009' as migration, coalesce(to_regclass('public.member_credential') is not null, false) as applied
  union all
  select '0010' as migration, coalesce(to_regclass('public.agent_message') is not null, false) as applied
  union all
  select '0011' as migration, coalesce(to_regclass('public.bite_consumed') is not null, false) as applied
  union all
  select '0012' as migration, coalesce(to_regclass('public.member_door') is not null, false) as applied
  union all
  select '0013' as migration, coalesce(to_regclass('public._rls_enabled') is not null, false) as applied
  union all
  select '0014' as migration, coalesce(to_regclass('public.reclaim_item') is not null, false) as applied
  union all
  select '0015' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_profile' and column_name='field_guide_seen_at'), false) as applied
  union all
  select '0016' as migration, coalesce(to_regclass('public.onboarding_session') is not null, false) as applied
  union all
  select '0017' as migration, coalesce(to_regclass('public.playbook_entry') is not null, false) as applied
  union all
  select '0018' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_profile' and column_name='threshold_crossed_at'), false) as applied
  union all
  select '0019' as migration, coalesce((exists(select 1 from pg_constraint where conname='reclaim_item_category_check' and pg_get_constraintdef(oid) like '%life%')), false) as applied
  union all
  select '0020' as migration, coalesce(to_regclass('public.measure') is not null, false) as applied
  union all
  select '0021' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_profile' and column_name='agent_memory'), false) as applied
  union all
  select '0022' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_profile' and column_name='dashboard_snapshot'), false) as applied
  union all
  select '0023' as migration, coalesce(to_regclass('public.session_progress') is not null, false) as applied
  union all
  select '0024' as migration, coalesce((exists(select 1 from pg_constraint where conname='playbook_entry_source_kind_check' and pg_get_constraintdef(oid) like '%session%')), false) as applied
  union all
  select '0025' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_profile' and column_name='phase_crossing_seen'), false) as applied
  union all
  select '0026' as migration, coalesce(to_regclass('public.daily_beat_log') is not null, false) as applied
  union all
  select '0027' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_profile' and column_name='playbook_synthesis'), false) as applied
  union all
  select '0028' as migration, coalesce(to_regclass('public.member_event') is not null, false) as applied
  union all
  select '0029' as migration, coalesce(to_regclass('public.member_feedback') is not null, false) as applied
  union all
  select '0030' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='activity_connection' and column_name='access_token_enc'), false) as applied
  union all
  select '0031' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_profile' and column_name='tour_completed_at'), false) as applied
  union all
  select '0032' as migration, coalesce((exists(select 1 from pg_trigger where tgname='member_profile_audit_del')), false) as applied
  union all
  select '0033' as migration, coalesce((coalesce(pg_get_functiondef(to_regprocedure('audit_member_profile()')) ilike '%dashboard_snapshot%', false)), false) as applied
  union all
  select '0034' as migration, coalesce(to_regclass('public.system_health') is not null, false) as applied
  union all
  select '0035' as migration, coalesce(to_regclass('public.connect_post') is not null, false) as applied
  union all
  select '0036' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='connect_report' and column_name='source'), false) as applied
  union all
  select '0037' as migration, coalesce(to_regclass('public.connect_notification') is not null, false) as applied
  union all
  select '0038' as migration, coalesce(to_regclass('public.connect_room') is not null, false) as applied
  union all
  select '0039' as migration, coalesce(to_regclass('public._rls_sweep_0039') is not null, false) as applied
  union all
  select '0040' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='reclaim_item' and column_name='removed_at'), false) as applied
  union all
  select '0041' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_profile_audit' and column_name='source'), false) as applied
  union all
  select '0042' as migration, coalesce(to_regclass('public._rls_sweep_0042') is not null, false) as applied
  union all
  select '0043' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_door' and column_name='removed_at'), false) as applied
  union all
  select '0044' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='atlas_asset' and column_name='administration_tier'), false) as applied
  union all
  select '0045' as migration, coalesce((exists(select 1 from pg_constraint where conname='reclaim_list_min_1')), false) as applied
  union all
  select '0046' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='playbook_entry' and column_name='keeper_type'), false) as applied
  union all
  select '0047' as migration, coalesce(to_regclass('public.grinta_reading') is not null, false) as applied
  union all
  select '0048' as migration, coalesce(to_regclass('public.practice_week') is not null, false) as applied
  union all
  select '0049' as migration, coalesce(to_regclass('public.momentum_call') is not null, false) as applied
  union all
  select '0050' as migration, coalesce(to_regclass('public.motivation_reading') is not null, false) as applied
  union all
  select '0051' as migration, coalesce(to_regclass('public.self_management_reading') is not null, false) as applied
  union all
  select '0052' as migration, coalesce(to_regclass('public.coaching_plan') is not null, false) as applied
  union all
  select '0053' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='reclaim_item' and column_name='tier'), false) as applied
) t
where applied = false   -- show ONLY the gaps; delete this line to see all 53
order by migration;
