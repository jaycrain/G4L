// Read-only member diagnostic — the structured, cross-phase snapshot an operator (or the operator's
// tooling) uses to spot data abnormalities in a member's walk (onboarding → Reconnect → Rewire →
// Rebuild → Reclaim). SELECT-only: it never mutates. Secrets (activity tokens) are stripped. The big
// blobs (arc transcripts, IDQ item responses, session answers) are reduced to counts/state so the
// report stays legible and doesn't dump raw conversation. Same shape the inspect-*.sql produces.
import type { Db } from '../db/schema.ts';

export type MemberMatch = { memberId: string; displayName: string; email: string; createdAt: string };

/** Resolve a search term to candidate members — exact member_id, or a name/email substring. */
export async function searchMembers(db: Db, q: string): Promise<MemberMatch[]> {
  const term = q.trim();
  const { rows } = await db.query<{ member_id: string; display_name: string; email: string; created_at: string }>(
    `select member_id, display_name, email, created_at
       from member_profile
      where member_id::text = $1 or display_name ilike '%'||$1||'%' or email ilike '%'||$1||'%'
      order by (member_id::text = $1) desc, created_at desc
      limit 10`,
    [term],
  );
  return rows.map((r) => ({ memberId: r.member_id, displayName: r.display_name, email: r.email, createdAt: r.created_at }));
}

// The report, parameterized by $1 = member_id. Mirrors scripts/db/inspect-donna.sql. FLAGS carries only
// anomalies (jsonb_strip_nulls drops the clean ones) so an empty {} means "nothing looks wrong".
const REPORT_SQL = `select jsonb_build_object(
  'profile', (select to_jsonb(p) - 'reclaim_list' from member_profile p where p.member_id = $1),
  'reclaim_count', (select count(*) from reclaim_item where member_id = $1),
  'reclaim_items', (select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order), '[]') from reclaim_item r where r.member_id = $1),
  'legacy_reclaim_list_jsonb', (select reclaim_list from member_profile where member_id = $1),
  'doors', (select coalesce(jsonb_agg(to_jsonb(d) order by d.sort_order), '[]') from member_door d where d.member_id = $1),
  'facets', (select coalesce(jsonb_agg(to_jsonb(f) order by f.sort_order), '[]') from facet f where f.member_id = $1),
  'idq_retakes', (select coalesce(jsonb_agg((to_jsonb(i) - 'responses') order by i.sequence_no), '[]') from idq_retake i where i.member_id = $1),
  'session_progress', (select coalesce(jsonb_agg((to_jsonb(s) - 'answers') order by s.updated_at), '[]') from session_progress s where s.member_id = $1),
  'arc_sessions', (select coalesce(jsonb_agg(jsonb_build_object(
       'arc', a.arc, 'state', a.state, 'msg_count', jsonb_array_length(a.messages), 'updated_at', a.updated_at) order by a.updated_at), '[]')
     from arc_session a where a.member_id = $1),
  'phase_gates', (select coalesce(jsonb_agg(to_jsonb(g) order by g.set_at), '[]') from phase_gate g where g.member_id = $1),
  'badges', (select coalesce(jsonb_agg(to_jsonb(b) order by b.earned_at), '[]') from badge_earned b where b.member_id = $1),
  'rebuild_readings', jsonb_build_object(
     'motivation',      (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from motivation_reading x      where x.member_id = $1),
     'self_management', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from self_management_reading x where x.member_id = $1),
     'coaching_plan',   (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from coaching_plan x           where x.member_id = $1)),
  'movement', jsonb_build_object(
     'connection', (select to_jsonb(c) - 'access_token_enc' - 'refresh_token_enc' from activity_connection c where c.member_id = $1),
     'event_count', (select count(*) from activity_event where member_id = $1),
     -- the actual synced rows (newest 15) so "my ride didn't sync" is inspectable: is it in the DB? when did it land?
     'recent_activities', (select coalesce(jsonb_agg(jsonb_build_object(
        'external_id', a.external_id, 'type', a.activity_type, 'name', a.name,
        'started_at', a.started_at, 'distance_m', a.distance_m, 'moving_time_s', a.moving_time_s, 'created_at', a.created_at
      ) order by a.started_at desc), '[]')
      from (select * from activity_event where member_id = $1 order by started_at desc limit 15) a)),
  'event_summary', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) n from member_event where member_id = $1 group by kind) t),
  'furthest_step_by_session', (select coalesce(jsonb_object_agg(ref, mx), '{}') from (select ref, max(step) mx from member_event where member_id = $1 and step is not null and ref is not null group by ref) t),
  'recent_events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]') from (select kind, surface, ref, step, created_at from member_event where member_id = $1 order by created_at desc limit 25) e),
  'FLAGS', (select jsonb_strip_nulls(jsonb_build_object(
     'identity_noun_missing',      case when (select identity_noun from member_profile where member_id = $1) is null then true end,
     'identity_paragraph_missing', case when (select identity_paragraph from member_profile where member_id = $1) is null then true end,
     'gap_missing',                case when (select intake_gap from member_profile where member_id = $1) is null then true end,
     'ai_consent_missing',         case when (select ai_consent_granted_at from member_profile where member_id = $1) is null then true end,
     'reclaim_below_floor',        case when (select count(*) from reclaim_item where member_id = $1) < 3 then (select count(*) from reclaim_item where member_id = $1) end,
     'reclaim_duplicate_texts',    (select case when count(*) > 0 then jsonb_agg(t) end from (select lower(btrim(text)) t from reclaim_item where member_id = $1 group by 1 having count(*) > 1) d),
     'no_doors',                   case when (select count(*) from member_door where member_id = $1) = 0 then true end,
     'door_primary_not_exactly_one', case when (select count(*) from member_door where member_id = $1 and is_primary) <> 1 then (select count(*) from member_door where member_id = $1 and is_primary) end,
     'named_door_vs_primary_mismatch', case when (select named_door from member_profile where member_id = $1)
                                            is distinct from (select door_slug from member_door where member_id = $1 and is_primary limit 1)
                                       then jsonb_build_object('named_door', (select named_door from member_profile where member_id = $1),
                                            'primary_member_door', (select door_slug from member_door where member_id = $1 and is_primary limit 1)) end,
     'no_baseline_idq',            case when not exists (select 1 from idq_retake where member_id = $1 and sequence_no = 0) then true end,
     'sessions_stuck_in_progress', (select case when count(*) > 0 then jsonb_agg(session_id) end from session_progress where member_id = $1 and status = 'in_progress'),
     'rebuild_underway_without_reconnect_core', case when exists (select 1 from phase_gate where member_id = $1 and gate = 'rebuild_underway')
                                                     and not exists (select 1 from phase_gate where member_id = $1 and gate = 'reconnect_core_complete') then true end
  )))
) as report`;

export type MemberDiagnostic = Record<string, unknown> & { FLAGS: Record<string, unknown> };

/** The full read-only report for one member. */
export async function runMemberDiagnostic(db: Db, memberId: string): Promise<MemberDiagnostic> {
  const { rows } = await db.query<{ report: MemberDiagnostic }>(REPORT_SQL, [memberId]);
  return rows[0]!.report;
}
