// Read-only member diagnostic — the structured, cross-phase snapshot an operator (or the operator's
// tooling) uses to spot data abnormalities in a member's walk (onboarding → Reconnect → Rewire →
// Rebuild → Reclaim). SELECT-only: it never mutates. Secrets (activity tokens) are stripped. The big
// blobs (arc transcripts, IDQ item responses, session answers) are reduced to counts/state so the
// report stays legible and doesn't dump raw conversation. Same shape the inspect-*.sql produces.
import type { Db } from '../db/schema.ts';

export type MemberMatch = { memberId: string; displayName: string; email: string; createdAt: string };

/** Resolve a search term to candidate members — exact member_id, or a name/email substring. */
// SEC-05 — SEARCH MUST NOT BE ENUMERATION. Two holes fed one outcome: LIKE wildcards were not escaped, so
// `?q=%` matched EVERY member (and `_` matched any single character), and even without wildcards a 1-2 char
// term swept most of the corpus a slice at a time. On this endpoint a "match" carries a real name and email
// for people whose membership is itself sensitive.
//
// So: wildcards are escaped to literals, and a term must be specific enough to be a LOOKUP rather than a
// trawl (a full UUID, or >= 3 characters). The operator knows who they are looking for; the endpoint exists
// to answer "show me this member", never "show me everyone".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DIAGNOSTIC_MIN_QUERY = 3;

/** Neutralise LIKE metacharacters so a member's search term can never widen the match. */
export function escapeLike(term: string): string {
  return term.replace(/([\\%_])/g, '\\$1');
}

/** True when a term is specific enough to be a lookup rather than a sweep of the member corpus. */
export function isSpecificEnough(term: string): boolean {
  const t = (term ?? '').trim();
  return UUID_RE.test(t) || t.length >= DIAGNOSTIC_MIN_QUERY;
}

export async function searchMembers(db: Db, q: string): Promise<MemberMatch[]> {
  const term = q.trim();
  if (!isSpecificEnough(term)) return [];
  const { rows } = await db.query<{ member_id: string; display_name: string; email: string; created_at: string }>(
    `select member_id, display_name, email, created_at
       from member_profile
      where member_id::text = $1
         or display_name ilike '%'||$2||'%' escape '\\'
         or email ilike '%'||$2||'%' escape '\\'
      order by (member_id::text = $1) desc, created_at desc
      limit 10`,
    [term, escapeLike(term)],
  );
  return rows.map((r) => ({ memberId: r.member_id, displayName: r.display_name, email: r.email, createdAt: r.created_at }));
}

/** An onboarding that STARTED but hasn't committed — no member row exists yet, so member_profile can't see it. */
export type InFlightOnboarding = {
  email: string;
  stage: string | null; // identity | gap | reclaim | grinta | complete | declined
  turns: number; // messages exchanged so far
  updatedAt: string;
  identityNoun: string | null;
  hasGap: boolean;
  reclaimCount: number;
  doors: string[];
};

/**
 * Find IN-FLIGHT onboardings by email/name substring. Without this, a prospect who started and stalled is
 * INVISIBLE — "they never began" and "we don't look there" read identically, which is exactly the drop-off
 * we most need to see before Charter. Metadata only: stage, turn count, and which fields are captured — never
 * the raw conversation (this is the most vulnerable moment in the product; the report stays legible and private).
 */
export async function findInFlightOnboarding(db: Db, q: string): Promise<InFlightOnboarding[]> {
  const term = q.trim();
  if (!isSpecificEnough(term)) return []; // SEC-05: same rule — a lookup, never a sweep
  const { rows } = await db.query<{
    email: string; updated_at: string; stage: string | null; turns: number;
    identity_noun: string | null; has_gap: boolean; reclaim_count: number; doors: unknown;
  }>(
    `select email,
            updated_at,
            state->>'stage'                                              as stage,
            coalesce(jsonb_array_length(messages), 0)                    as turns,
            state->'collected'->>'identityNoun'                          as identity_noun,
            coalesce(length(state->'collected'->>'gap') > 0, false)      as has_gap,
            coalesce(jsonb_array_length(state->'collected'->'reclaimList'), 0) as reclaim_count,
            coalesce(state->'collected'->'doors', '[]'::jsonb)           as doors
       from onboarding_session
      where email ilike '%'||$1||'%' escape '\\'
      order by updated_at desc
      limit 10`,
    [escapeLike(term)],
  );
  return rows.map((r) => ({
    email: r.email,
    stage: r.stage,
    turns: Number(r.turns ?? 0),
    updatedAt: r.updated_at,
    identityNoun: r.identity_noun,
    hasGap: !!r.has_gap,
    reclaimCount: Number(r.reclaim_count ?? 0),
    doors: Array.isArray(r.doors) ? (r.doors as string[]) : [],
  }));
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
  -- The GRINTA readings (survey Grinta Index, migration 0047). A FROZEN data contract the member sees on their card
  -- and dashboard, so it must be inspectable here — its absence from this report used to be unreadable: you couldn't
  -- tell "the baseline never saved" from "the diagnostic doesn't look".
  'grinta_readings', (select coalesce(jsonb_agg((to_jsonb(g) - 'responses') order by g.sequence_no), '[]') from grinta_reading g where g.member_id = $1),
  'session_progress', (select coalesce(jsonb_agg((to_jsonb(s) - 'answers') order by s.updated_at), '[]') from session_progress s where s.member_id = $1),
  'arc_sessions', (select coalesce(jsonb_agg(jsonb_build_object(
       'arc', a.arc, 'state', a.state, 'msg_count', jsonb_array_length(a.messages), 'updated_at', a.updated_at) order by a.updated_at), '[]')
     from arc_session a where a.member_id = $1),
  'phase_gates', (select coalesce(jsonb_agg(to_jsonb(g) order by g.set_at), '[]') from phase_gate g where g.member_id = $1),
  -- Playbook keepers — so a play's keeper_type/state/source_label is inspectable (e.g. "why no Run-it-again button?").
  'playbook', (select coalesce(jsonb_agg(jsonb_build_object(
       'section', p.section, 'keeper_type', p.keeper_type, 'state', p.state, 'pinned', p.pinned,
       'source_kind', p.source_kind, 'source_ref', p.source_ref, 'source_label', p.source_label,
       'body', left(p.body, 80)) order by p.section, p.sort_order), '[]')
     from playbook_entry p where p.member_id = $1),
  'badges', (select coalesce(jsonb_agg(to_jsonb(b) order by b.earned_at), '[]') from badge_earned b where b.member_id = $1),
  'rebuild_readings', jsonb_build_object(
     'motivation',      (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from motivation_reading x      where x.member_id = $1),
     'self_management', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from self_management_reading x where x.member_id = $1),
     'coaching_plan',   (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from coaching_plan x           where x.member_id = $1)),
  -- Reclaim's durable readings. C2's was MISSING here until 2026-08-07, which is how "did Greg actually answer the
  -- Bigger World Audit, or did he click through it in 73 seconds?" became unanswerable from this report — the one
  -- question the report exists to answer. An absent register and an absent LOOK are indistinguishable to the reader,
  -- so anything a member's record holds has to be visible here.
  'reclaim_readings', jsonb_build_object(
     'bigger_world',   (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from bigger_world_reading x where x.member_id = $1),
     'quality_day',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from quality_day_log x      where x.member_id = $1)),
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
     -- Every member who finishes intake takes the Grinta baseline survey, so a committed member with no onboarding
     -- grinta_reading means the frozen baseline silently failed to persist. Surface it rather than leaving it unread.
     'no_grinta_baseline',         case when not exists (select 1 from grinta_reading where member_id = $1 and source = 'onboarding') then true end,
     'sessions_stuck_in_progress', (select case when count(*) > 0 then jsonb_agg(session_id) end from session_progress where member_id = $1 and status = 'in_progress'),
     -- TELEMETRY vs TRUTH. Two records of the same fact must agree: session_progress is what the product reads, the
     -- member_event log is what QI measures. When they diverge, the product looks right and the measurement lies —
     -- which is exactly what happened on Greg's walk (12 sessions closed, 9 session_close events; 4 checkpoints
     -- crossed, 0 progress rows). Finding that took an afternoon of forensics. These make it a line in the report.
     -- Both sides must speak through the ALIAS MAP. Two checkpoints record their progress row under the curriculum id
     -- and their event under a different historical ref (RBLD-B4/RBD-CHK, RCL-C4/RCL-CHK — see markCheckpointClosed).
     -- Without the map these two flags fire on that divergence forever, for every member who finishes Rebuild or
     -- Reclaim. They did, on Greg, within an hour of shipping: a flag that cries wolf on a known-good state is worse
     -- than no flag, because it trains you to skim past the real ones sitting next to it.
     'closed_without_close_event', (select case when count(*) > 0 then jsonb_agg(s.session_id) end
        from session_progress s where s.member_id = $1 and s.status = 'closed'
        and not exists (select 1 from member_event e where e.member_id = $1
                        and e.kind in ('session_close','checkpoint_cross')
                        and e.ref in (s.session_id, (select alias from (values
                             ('RBLD-B4','RBD-CHK'), ('RCL-C4','RCL-CHK')) as a(id, alias) where a.id = s.session_id)))),
     'close_event_without_progress_row', (select case when count(*) > 0 then jsonb_agg(distinct e.ref) end
        from member_event e where e.member_id = $1 and e.kind in ('session_close','checkpoint_cross') and e.ref is not null
        and not exists (select 1 from session_progress s where s.member_id = $1
                        and s.session_id in (e.ref, (select id from (values
                             ('RBLD-B4','RBD-CHK'), ('RCL-C4','RCL-CHK')) as a(id, alias) where a.alias = e.ref)))),
     -- A gateway between the Rs is crossed once per cycle. More than one event for the same ref means an unguarded
     -- emit somewhere (the shape that double-counted Greg's capstone 35 minutes apart).
     'checkpoint_crossed_more_than_once', (select case when count(*) > 0 then jsonb_object_agg(ref, n) end
        from (select ref, count(*) n from member_event where member_id = $1 and kind = 'checkpoint_cross' and ref is not null
              group by ref having count(*) > 1) d),
     -- The gate is what the forecast believes; the progress row is what the counters read. Passing a gate with no
     -- closed row means the member's completion is REAL but INVISIBLE — Greg had all four. The gate→asset pairing is
     -- a fixed four-row map, so it's spelled out rather than derived from the gate string.
     'checkpoint_gate_without_progress_row', (select case when count(*) > 0 then jsonb_agg(m.gate) end
        from (values ('reconnect_checkpoint_passed','RCN-CHK'), ('rewire_checkpoint_passed','RWR-CHK'),
                     ('rebuild_checkpoint_passed','RBLD-B4'), ('reclaim_checkpoint_passed','RCL-C4')) as m(gate, asset_id)
        where exists (select 1 from phase_gate g where g.member_id = $1 and g.gate = m.gate)
        and not exists (select 1 from session_progress s
                        where s.member_id = $1 and s.session_id = m.asset_id and s.status = 'closed')),
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
