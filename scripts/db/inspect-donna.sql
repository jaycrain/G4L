-- READ-ONLY member diagnostic — Donna's walk (onboarding → Reconnect → Rewire → Rebuild).
-- Paste into the Supabase SQL Editor and run. Returns ONE cell of pretty JSON: the full cross-phase
-- state + a FLAGS object that only lists anomalies (empty/absent = clean). No writes. Secrets stripped.
-- If more than one "Donna" exists, `all_matches` lists them and the report uses the most recent.
with cand as (
  select member_id, display_name, email, created_at
  from member_profile
  where display_name ilike '%donna%' or email ilike '%donna%'
  order by created_at desc
),
m as (select member_id from cand limit 1)
select jsonb_pretty(jsonb_build_object(
  'matches', (select count(*) from cand),
  'all_matches', (select coalesce(jsonb_agg(jsonb_build_object(
     'member_id', member_id, 'name', display_name, 'email', email, 'created', created_at)), '[]') from cand),
  'profile', (select to_jsonb(p) - 'reclaim_list' from member_profile p where p.member_id = (select member_id from m)),
  'reclaim_count', (select count(*) from reclaim_item where member_id = (select member_id from m)),
  'reclaim_items', (select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order), '[]')
                    from reclaim_item r where r.member_id = (select member_id from m)),
  'legacy_reclaim_list_jsonb', (select reclaim_list from member_profile where member_id = (select member_id from m)),
  'doors', (select coalesce(jsonb_agg(to_jsonb(d) order by d.sort_order), '[]')
            from member_door d where d.member_id = (select member_id from m)),
  'facets', (select coalesce(jsonb_agg(to_jsonb(f) order by f.sort_order), '[]')
             from facet f where f.member_id = (select member_id from m)),
  'idq_retakes', (select coalesce(jsonb_agg((to_jsonb(i) - 'responses') order by i.sequence_no), '[]')
                  from idq_retake i where i.member_id = (select member_id from m)),
  'session_progress', (select coalesce(jsonb_agg((to_jsonb(s) - 'answers') order by s.updated_at), '[]')
                       from session_progress s where s.member_id = (select member_id from m)),
  'arc_sessions', (select coalesce(jsonb_agg(jsonb_build_object(
       'arc', a.arc, 'state', a.state,
       'msg_count', jsonb_array_length(a.messages), 'updated_at', a.updated_at) order by a.updated_at), '[]')
     from arc_session a where a.member_id = (select member_id from m)),
  'phase_gates', (select coalesce(jsonb_agg(to_jsonb(g) order by g.set_at), '[]')
                  from phase_gate g where g.member_id = (select member_id from m)),
  'badges', (select coalesce(jsonb_agg(to_jsonb(b) order by b.earned_at), '[]')
             from badge_earned b where b.member_id = (select member_id from m)),
  'rebuild_readings', jsonb_build_object(
     'motivation',      (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from motivation_reading x      where x.member_id = (select member_id from m)),
     'self_management', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from self_management_reading x where x.member_id = (select member_id from m)),
     'coaching_plan',   (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from coaching_plan x           where x.member_id = (select member_id from m))),
  'movement', jsonb_build_object(
     'connection', (select to_jsonb(c) - 'access_token_enc' - 'refresh_token_enc'
                    from activity_connection c where c.member_id = (select member_id from m)),
     'event_count', (select count(*) from activity_event    where member_id = (select member_id from m))),
  'event_summary', (select coalesce(jsonb_object_agg(kind, n), '{}')
     from (select kind, count(*) n from member_event where member_id = (select member_id from m) group by kind) t),
  'furthest_step_by_session', (select coalesce(jsonb_object_agg(ref, mx), '{}')
     from (select ref, max(step) mx from member_event
           where member_id = (select member_id from m) and step is not null and ref is not null group by ref) t),
  'recent_events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]')
     from (select kind, surface, ref, step, created_at from member_event
           where member_id = (select member_id from m) order by created_at desc limit 25) e),
  'FLAGS', (select jsonb_strip_nulls(jsonb_build_object(
     'no_match',                  case when (select count(*) from cand) = 0 then true end,
     'multiple_matches',          case when (select count(*) from cand) > 1 then (select count(*) from cand) end,
     'identity_noun_missing',     case when (select identity_noun      from member_profile where member_id = (select member_id from m)) is null then true end,
     'identity_paragraph_missing',case when (select identity_paragraph from member_profile where member_id = (select member_id from m)) is null then true end,
     'gap_missing',               case when (select intake_gap         from member_profile where member_id = (select member_id from m)) is null then true end,
     'ai_consent_missing',        case when (select ai_consent_granted_at from member_profile where member_id = (select member_id from m)) is null then true end,
     'reclaim_below_floor',       case when (select count(*) from reclaim_item where member_id = (select member_id from m)) < 3
                                       then (select count(*) from reclaim_item where member_id = (select member_id from m)) end,
     'reclaim_duplicate_texts',   (select case when count(*) > 0 then jsonb_agg(t) end
                                    from (select lower(btrim(text)) t from reclaim_item
                                          where member_id = (select member_id from m) group by 1 having count(*) > 1) d),
     'no_doors',                  case when (select count(*) from member_door where member_id = (select member_id from m)) = 0 then true end,
     'door_primary_not_exactly_one', case when (select count(*) from member_door where member_id = (select member_id from m) and is_primary) <> 1
                                       then (select count(*) from member_door where member_id = (select member_id from m) and is_primary) end,
     'named_door_vs_primary_mismatch', case when (select named_door from member_profile where member_id = (select member_id from m))
                                            is distinct from (select door_slug from member_door where member_id = (select member_id from m) and is_primary limit 1)
                                       then jsonb_build_object(
                                            'named_door', (select named_door from member_profile where member_id = (select member_id from m)),
                                            'primary_member_door', (select door_slug from member_door where member_id = (select member_id from m) and is_primary limit 1)) end,
     'no_baseline_idq',           case when not exists (select 1 from idq_retake where member_id = (select member_id from m) and sequence_no = 0) then true end,
     'sessions_stuck_in_progress',(select case when count(*) > 0 then jsonb_agg(session_id) end
                                    from session_progress where member_id = (select member_id from m) and status = 'in_progress'),
     'rebuild_underway_without_reconnect_core', case when exists (select 1 from phase_gate where member_id = (select member_id from m) and gate = 'rebuild_underway')
                                                     and not exists (select 1 from phase_gate where member_id = (select member_id from m) and gate = 'reconnect_core_complete')
                                                then true end
  )))
)) as donna_report;
