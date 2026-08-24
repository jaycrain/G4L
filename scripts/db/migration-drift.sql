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
  select '0019' as migration, coalesce((exists (select 1 from pg_constraint where conname='reclaim_item_category_check' and pg_get_constraintdef(oid) like '%life%')), false) as applied
  union all
  select '0020' as migration, coalesce(to_regclass('public.measure') is not null, false) as applied
  union all
  select '0021' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_profile' and column_name='agent_memory'), false) as applied
  union all
  select '0022' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_profile' and column_name='dashboard_snapshot'), false) as applied
  union all
  select '0023' as migration, coalesce(to_regclass('public.session_progress') is not null, false) as applied
  union all
  select '0024' as migration, coalesce((exists (select 1 from pg_constraint where conname='playbook_entry_source_kind_check' and pg_get_constraintdef(oid) like '%session%')), false) as applied
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
  select '0032' as migration, coalesce((exists (select 1 from pg_trigger where tgname = 'member_profile_audit_del')), false) as applied
  union all
  select '0033' as migration, coalesce(((pg_get_functiondef('audit_member_profile'::regproc) ilike '%dashboard_snapshot%')), false) as applied
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
  select '0045' as migration, coalesce((exists (select 1 from pg_constraint where conname = 'reclaim_list_min_1')), false) as applied
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
  union all
  select '0054' as migration, coalesce(to_regclass('public.bigger_world_reading') is not null, false) as applied
  union all
  select '0055' as migration, coalesce(to_regclass('public.quality_day_log') is not null, false) as applied
  union all
  select '0056' as migration, coalesce(to_regclass('public.arc_session') is not null, false) as applied
  union all
  select '0057' as migration, coalesce(to_regclass('public.movement_log') is not null, false) as applied
  union all
  select '0058' as migration, coalesce(to_regclass('public.outreach_pref') is not null, false) as applied
  union all
  select '0059' as migration, coalesce(to_regclass('public.outreach_log') is not null, false) as applied
  union all
  select '0060' as migration, coalesce(to_regclass('public.commitment') is not null, false) as applied
  union all
  select '0061' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='commitment' and column_name='reclaim_item_id'), false) as applied
  union all
  select '0062' as migration, coalesce(to_regclass('public.auth_attempt') is not null, false) as applied
  union all
  select '0063' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_credential' and column_name='email_verified_at'), false) as applied
  union all
  select '0064' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_session' and column_name='token_hash'), false) as applied
  union all
  select '0065' as migration, coalesce(to_regclass('public.system_health_event') is not null, false) as applied
  union all
  select '0066' as migration, coalesce(to_regclass('public.founder_message') is not null, false) as applied
  union all
  select '0067' as migration, coalesce(to_regclass('public.founder_prompt') is not null, false) as applied
  union all
  select '0068' as migration, coalesce((not exists (
              select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'member_session' and column_name = 'token'
            )), false) as applied
  union all
  select '0069' as migration, coalesce(to_regclass('public.founder_state') is not null, false) as applied
  union all
  select '0070' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='founder_state' and column_name='theme'), false) as applied
  union all
  select '0071' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='founder_agent_drafts' and column_name='rejected_at'), false) as applied
  union all
  select '0072' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='practice_week' and column_name='closed_at'), false) as applied
  union all
  select '0073' as migration, coalesce(to_regclass('public.member_access_log') is not null, false) as applied
  union all
  select '0074' as migration, coalesce(to_regclass('public.w3_daily_entry') is not null, false) as applied
  union all
  select '0075' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='bigger_world_reading' and column_name='reflections'), false) as applied
  union all
  select '0076' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='quality_day_log' and column_name='source'), false) as applied
  union all
  select '0077' as migration, coalesce((not exists (
              select 1 from coaching_plan where jsonb_typeof(payload) = 'string'
              union all select 1 from bigger_world_reading where jsonb_typeof(priorities) = 'string'
            )), false) as applied
  union all
  select '0078' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_profile' and column_name='timezone'), false) as applied
  union all
  select '0079' as migration, coalesce((exists (select 1 from pg_trigger where tgname='playbook_entry_audit_upd')), false) as applied
  union all
  select '0080' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='onboarding_session' and column_name='crisis_flagged_at'), false) as applied
  union all
  select '0081' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_access_log' and column_name='prospect_email'), false) as applied
  union all
  select '0082' as migration, coalesce(to_regclass('public.companion_notice') is not null, false) as applied
  union all
  select '0083' as migration, coalesce(to_regclass('public.legacy_letter') is not null, false) as applied
  union all
  select '0084' as migration, coalesce(to_regclass('public.b3_daily_entry') is not null, false) as applied
  union all
  select '0085' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_door' and column_name='still_open'), false) as applied
  union all
  select '0086' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_profile' and column_name='quiet_drift_claimed_at'), false) as applied
  union all
  select '0087' as migration, coalesce((exists (select 1 from door where slug = 'autopilot')), false) as applied
  union all
  select '0088' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='b3_daily_entry' and column_name='activity_status'), false) as applied
  union all
  select '0089' as migration, coalesce(to_regclass('public.member_language_suppressed') is not null, false) as applied
  union all
  select '0090' as migration, coalesce(exists(select 1 from information_schema.columns where table_schema='public' and table_name='onboarding_session' and column_name='display_name'), false) as applied
) t
where applied = false   -- show ONLY the gaps; delete this line to see all 90
order by migration;
