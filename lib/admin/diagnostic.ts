// Read-only member diagnostic — the structured, cross-phase snapshot an operator (or the operator's
// tooling) uses to spot data abnormalities in a member's walk (onboarding → Reconnect → Rewire →
// Rebuild → Reclaim). SELECT-only: it never mutates. Secrets (activity tokens) are stripped. The big
// blobs (arc transcripts, IDQ item responses, session answers) are reduced to counts/state so the
// report stays legible and doesn't dump raw conversation. Same shape the inspect-*.sql produces.
import type { Db } from '../db/schema.ts';
import { isPurgeable } from '../demo/purge-member.ts';

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
  /** CONFIRMED Doors — she has ruled on these at the gap confirm. */
  doors: string[];
  /** PENDING Doors — heard, shown, not yet ruled on.
   *
   *  This field was missing until 2026-08-25 and its absence made the report LIE BY OMISSION. Through the whole
   *  gap stage every Door lives here and `doors` is empty, so the diagnostic answered "doors: []" for a member
   *  who had been shown one — indistinguishable from a member for whom we had matched nothing. Jay asked, mid-walk,
   *  why a Door had vanished; the instrument I reached for could not see the field he was asking about, and it
   *  reported an empty array with total confidence. An operator surface that cannot tell "none" from "not looked
   *  at" is worse than one that says nothing. */
  doorsProposed: string[];
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
    doors_proposed: unknown;
  }>(
    `select email,
            updated_at,
            state->>'stage'                                              as stage,
            coalesce(jsonb_array_length(messages), 0)                    as turns,
            state->'collected'->>'identityNoun'                          as identity_noun,
            coalesce(length(state->'collected'->>'gap') > 0, false)      as has_gap,
            coalesce(jsonb_array_length(state->'collected'->'reclaimList'), 0) as reclaim_count,
            coalesce(state->'collected'->'doors', '[]'::jsonb)           as doors,
            coalesce(state->'collected'->'doorsProposed', '[]'::jsonb)   as doors_proposed
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
    doorsProposed: Array.isArray(r.doors_proposed) ? (r.doors_proposed as string[]) : [],
  }));
}

/**
 * The RAW onboarding transcript — deliberately the narrowest thing in this file, and the only place the report
 * returns a member's own words.
 *
 * WHY IT EXISTS. When a walk breaks mid-conversation, the metadata above says WHERE it stopped and nothing about
 * WHY. On 2026-08-20 that cost a real walk: Donna stalled in the reclaim stage, I could not reproduce it offline,
 * and I guessed twice at the cause — each guess a fresh round of her time and Jay's. The turn-by-turn is the only
 * artifact that answers it.
 *
 * WHY IT IS ALLOWLISTED TO TESTERS, NOT TO OPERATORS. Everything else here drops the member's words on purpose:
 * idq_retake omits `responses`, the Legacy Letter reports a character count and not a line of the letter, and the
 * in-flight report is metadata only "because this is the most vulnerable moment in the product". That rule is
 * right and it stays. What changes is not the rule but the SET it applies to.
 *
 * THIS USED TO REUSE `isPurgeable`, on the argument that a second list could drift from the first. That argument
 * was wrong, and 2026-08-24 is when it cost something: a real prospect was declined at intake, and the only way to
 * SEE WHY was to add him to a list whose other job is destroying accounts. Reading someone's conversation and
 * being allowed to erase them are different acts, and binding them together made "leave him alone" and "make him
 * wipeable" the same decision.
 *
 * The drift worry does not survive the split, because these are genuinely different sets and neither direction is
 * dangerous: a tester we can wipe but need not read, and a person we need to understand but must never wipe. What
 * IS load-bearing is that a member on NEITHER list stays unreachable — asserted in tests/transcript-access.test.ts.
 *
 * A REAL MEMBER'S TRANSCRIPT IS NOT REACHABLE THROUGH THIS. Not by an operator, not with the token, not by asking
 * differently. If we ever need one, that is a consent conversation and a different mechanism.
 */
/**
 * WHOSE CONVERSATION AN OPERATOR MAY READ. Separate from PURGEABLE, and the split is the point.
 *
 * Until 2026-08-24 this gated on the purge allowlist, so the only way to UNDERSTAND what happened to someone was
 * to also make their account destroyable. Those are not the same act, and conflating them made the safer choice
 * (leave them alone) and the more dangerous one (make them wipeable) the same decision.
 *
 * It surfaced when a real prospect was declined at intake and we could not see why without putting him on a list
 * built for resetting testers.
 *
 * READING IS STILL THE HIGHER BAR IN PRACTICE: this is the hardest part of somebody's life, told to a product on
 * the promise that it was safe to be honest. A line here needs a NAME and a REASON, and should come off when the
 * reason expires. `.test` fixtures are always readable — they are nobody.
 */
export const TRANSCRIPT_READABLE = [
  'donnacrain19@gmail.com',   // Donna — charter tester; walks onboarding end-to-end on every intake change.
  'dctestemail@mac.com',      // Donna's second address, used for short single-feature walks.
  'tim@carlin.com',           // Tim Carlin — DECLINED at intake 2026-08-14 after 13 turns. Reading it to find out
                              // whether the no-fade gate turned away a real member. REMOVE once that is answered.
  'jaycrain@mac.com',         // Jay's own charter walk, 2026-08-25 — added at his explicit request WHILE walking,
                              // to diagnose Door under-matching from what he actually typed rather than from a
                              // summary of it. His own words about his own life, and he is the one asking.
] as const;

/** May an operator read this conversation? `.test` fixtures always; real addresses only by name. */
export function isTranscriptReadable(email: string): boolean {
  const e = (email ?? '').trim().toLowerCase();
  if (!e) return false;
  if (/\.test$/i.test(e)) return true;
  return (TRANSCRIPT_READABLE as readonly string[]).some((a) => a.toLowerCase() === e);
}

export async function inFlightTranscript(
  db: Db,
  email: string,
): Promise<{ ok: true; messages: { role: string; text: string }[]; state: unknown } | { ok: false; reason: string }> {
  const e = (email ?? '').trim();
  if (!isTranscriptReadable(e)) return { ok: false, reason: 'transcripts are readable only for named accounts' };
  const { rows } = await db.query<{ messages: unknown; state: unknown }>(
    'select messages, state from onboarding_session where lower(email) = lower($1)',
    [e],
  );
  const r = rows[0];
  if (!r) return { ok: false, reason: 'no in-flight onboarding for that address' };
  const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);
  const messages = parse(r.messages);
  return {
    ok: true,
    messages: Array.isArray(messages) ? (messages as { role: string; text: string }[]) : [],
    state: parse(r.state),
  };
}

// The report, parameterized by $1 = member_id. Mirrors scripts/db/inspect-donna.sql. FLAGS carries only
// anomalies (jsonb_strip_nulls drops the clean ones) so an empty {} means "nothing looks wrong".
const REPORT_SQL = `select jsonb_build_object(
  'profile', (select to_jsonb(p) - 'reclaim_list' from member_profile p where p.member_id = $1),
  'reclaim_count', (select count(*) from reclaim_item where member_id = $1),
  'reclaim_items', (select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order), '[]') from reclaim_item r where r.member_id = $1),
  'legacy_reclaim_list_jsonb', (select reclaim_list from member_profile where member_id = $1),
  -- THE LEGACY LETTER (0083). It was invisible here until 2026-08-18: Donna finished Reconnect having written one
  -- and this report could not say so, which makes a headline artifact unverifiable from the operator surface —
  -- exactly the "you couldn't tell 'it never saved' from 'the diagnostic doesn't look'" failure the Grinta line
  -- above was added for.
  --
  -- BODY AND ANSWERS ARE DELIBERATELY OMITTED. Every other row here drops the member's own words for the same
  -- reason (idq_retake drops 'responses', arc_sessions reports msg_count, not messages), and this is the most
  -- private thing the product holds — a letter someone wrote to themselves, dated a year out. Length is enough to
  -- tell a real letter from an empty one; reading it is not an operational need.
  'legacy_letter', (select jsonb_build_object(
       'dated_for', l.dated_for,
       'chars', length(l.body),
       'answers_given', (select count(*) from jsonb_object_keys(coalesce(l.answers, '{}'::jsonb))),
       'has_shared_line', l.shared_line is not null,
       'opened_at', l.opened_at,
       'created_at', l.created_at,
       'updated_at', l.updated_at,
       'revised', l.updated_at > l.created_at)
     from legacy_letter l where l.member_id = $1),
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
  -- Body preview is 600, not 80. See the note above this query.
  'playbook', (select coalesce(jsonb_agg(jsonb_build_object(
       'section', p.section, 'keeper_type', p.keeper_type, 'state', p.state, 'pinned', p.pinned,
       'source_kind', p.source_kind, 'source_ref', p.source_ref, 'source_label', p.source_label,
       'body', case when length(p.body) > 600 then left(p.body, 600) || '...[truncated]' else p.body end)
     order by p.section, p.sort_order), '[]')
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
  -- The practice week, as the member sees it on their grid. Added the SAME DAY the grid shipped, because this morning
  -- the identical gap (C2's reading missing here) made "did Greg actually answer it?" unanswerable from the one tool
  -- built to answer it. Shipping a member-facing surface whose state can't be inspected just moves the forensics to
  -- later, when it costs more.
  'practice', jsonb_build_object(
     'weeks',       (select coalesce(jsonb_agg(to_jsonb(w)), '[]') from practice_week w where w.member_id = $1),
     'commitments', (select coalesce(jsonb_agg(to_jsonb(c) order by c.kind, c.sort_order), '[]') from practice_commitment c where c.member_id = $1),
     -- Marks roll up per (kind, commitment) rather than listing every row: the question is always "how many days,
     -- and which", never the individual row ids.
     'marks',       (select coalesce(jsonb_agg(m), '[]') from (
                       select kind, commitment_id, count(*) as days, min(marked_on)::text as first_on, max(marked_on)::text as last_on
                         from practice_mark where member_id = $1 group by kind, commitment_id) m)),
  'event_summary', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) n from member_event where member_id = $1 group by kind) t),
     -- READ FROM session_progress, NOT member_event (2026-08-26). This used to aggregate member_event rows carrying
     -- BOTH step and ref; exactly one call site in the product writes step (idq_complete) and it passes no ref, so
     -- the field returned an empty object for every member who has ever used this product. It rendered as a member
     -- who never dropped off anywhere, which is the most misleading possible way to show "we are not measuring it".
     -- session_progress.current_step is the real record: monotonic by greatest() since 0023, and advanced every
     -- turn by recordFurthestStep as of today.
     -- (No backticks in this comment: the whole query is a TS template literal, and the first one ended the string.)
     'furthest_step_by_session', (select coalesce(jsonb_object_agg(session_id, current_step), '{}')
        from session_progress where member_id = $1 and current_step is not null),
  'recent_events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]') from (select kind, surface, ref, step, created_at from member_event where member_id = $1 order by created_at desc limit 25) e),
  -- WHY THE COMPANION WENT BLIND. recent_events deliberately drops meta (it is a timeline, not a dump), so a
  -- context_degraded row would appear there as a bare word with the reason stripped off — visible and useless.
  -- This block carries the message. The Companion telling a member "I can't see your record this minute" is the
  -- most serious quiet failure we have, and it was diagnosed twice off a screenshot before this existed.
  -- (No backticks in this comment: the SQL lives inside a TS template literal and one would end the string.)
  'context_degraded', (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]')
     from (select created_at, meta->>'message' as message from member_event
            where member_id = $1 and kind = 'context_degraded' order by created_at desc limit 10) e),
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
     -- R3 writes the Legacy Letter before the Checkpoint, so a member past reconnect_checkpoint_passed without one
     -- means that beat ran and produced nothing. Scoped to members who actually finished the gateway, so it stays
     -- silent for everyone still inside it rather than crying wolf on every new member.
     'reconnect_done_no_legacy_letter', case when exists (select 1 from phase_gate where member_id = $1 and gate = 'reconnect_checkpoint_passed')
                                              and not exists (select 1 from legacy_letter where member_id = $1)
                                         then true end,
     -- Every member who finishes intake takes the Grinta baseline survey, so a committed member with no onboarding
     -- grinta_reading means the frozen baseline silently failed to persist. Surface it rather than leaving it unread.
     'no_grinta_baseline',         case when not exists (select 1 from grinta_reading where member_id = $1 and source = 'onboarding') then true end,
     -- A week whose window elapsed and that nothing closed. Before closed_at this state was invisible AND permanent;
     -- now it should only ever be transient (the next Companion turn reviews and closes it), so a lingering one means
     -- the close beat isn't firing for that member.
     'practice_week_overdue_to_close', (select case when count(*) > 0 then jsonb_agg(kind) end
        from practice_week where member_id = $1 and closed_at is null
        and started_at < now() - interval '7 days'),
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

/**
 * The full read-only report for one member — the SQL snapshot plus `renders`, which runs the real read models.
 *
 * `renders` exists because of 2026-08-11. Jay finished Quality Days and reported no tracker on the Playbook's
 * "This week". The SQL said both halves were there — the profile and the c3_quality week — and a live walk on a
 * demo account said the grid renders. Both were true and neither answered the question, because what the Playbook
 * shows is not the rows, it is `weekGrids(rows)`: a read model with per-kind adapters, a joins-the-profile step,
 * and a `rows.length > 0` filter that silently drops a week whose adapter came back empty.
 *
 * So the report now includes what the member's surface would actually RENDER, not just what it reads from. This is
 * [[existence-is-not-the-assertion]] built into the instrument: a row existing is not the assertion, the grid
 * appearing is.
 */
/**
 * WHY THE PLAYBOOK BODY PREVIEW IS 600 AND NOT 80.
 *
 * It was `left(p.body, 80)`, and on 2026-08-22 that cost an hour and produced a false bug report about a real
 * member's data. Reading Donna's finished walk, her False Start Protocol came back as:
 *
 *   Triggers: When I am tired. When I've gotten into conflict with Jay.
 *   Redirect — B
 *
 * I told Jay her protocol was cut mid-word, and that one field was somehow holding two different values — "B" in
 * the keeper and "Box breathing" in her week row — which is impossible, so something was badly wrong. Nothing was
 * wrong. The protocol is one keeper carrying four lines and I was reading a preview.
 *
 * THE TELL WAS IN DATA I HAD ALREADY PRINTED: ten of her eighteen keepers were exactly 80 characters and none was
 * longer. A clean cap landing on a round number is the query, never the member.
 *
 * A DIAGNOSTIC THAT SILENTLY ABBREVIATES MANUFACTURES BUGS. This report exists to answer "what is actually
 * stored", and an unmarked truncation answers a different question while looking like the first one. 600 fits the
 * composed artifacts whole (the protocol, the identity paragraph, long Reclaim items); past that it appends
 * "...[truncated]" so it can never be mistaken for the value again.
 *
 * AND THE NOTE LIVES HERE, NOT IN THE SQL. The first version of this explanation went inside the query as `--`
 * comments containing em-dashes, which broke it — three diagnostic tests went red with "syntax error at or near
 * —". Prose belongs outside the string.
 */
export async function runMemberDiagnostic(db: Db, memberId: string): Promise<MemberDiagnostic> {
  const { rows } = await db.query<{ report: MemberDiagnostic }>(REPORT_SQL, [memberId]);
  const report = rows[0]!.report;
  report.renders = await memberRenders(db, memberId);
  return report;
}

/**
 * What the member's surfaces would render right now, through the same read models the pages call.
 *
 * Each one is caught SEPARATELY and reports its own error string. A shared catch here would collapse "this grid
 * came back empty" and "the whole read threw" into one indistinguishable null — which is the exact confusion this
 * block was added to end.
 */
async function memberRenders(db: Db, memberId: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  try {
    const { weekGrids } = await import('../practice/grid.ts');
    const grids = await weekGrids(db, memberId);
    // The shape a "why is my tracker missing" question needs: which weeks made it through, and with what rows.
    out.playbook_this_week = grids.map((g) => ({ kind: g.kind, day: g.day, rows: g.rows.map((r) => r.label) }));
  } catch (e) {
    out.playbook_this_week = { ERROR: (e as Error).message };
  }
  try {
    const { activePracticeWeeks } = await import('../practice/store.ts');
    const open = await activePracticeWeeks(db, memberId);
    // Every OPEN week, so a week that opened and then rendered nothing is visible as the gap between the two lists
    // rather than as an absence you have to notice.
    // The WINDOW, not just the day. "day 2" alone is unreadable once a week can be 6 days or 7 and can be a
    // partial first stub — and this endpoint is how prod gets inspected at all, so an instrument that reports
    // half the model is how the next wrong date goes unnoticed.
    out.open_weeks = open.map((w) => ({
      kind: w.kind,
      day: w.day,
      startedOn: w.startedOn,
      window: { start: w.window.start, end: w.window.end, days: w.window.days, partial: w.window.partial },
      reviewOn: w.run.main.end,
      prior: w.prior ? { start: w.prior.start, end: w.prior.end, days: w.prior.days } : null,
    }));
  } catch (e) {
    out.open_weeks = { ERROR: (e as Error).message };
  }
  try {
    const { activeQualityDayProfile, profileElements } = await import('../reclaim/quality-day-store.ts');
    const p = await activeQualityDayProfile(db, memberId);
    out.quality_day_profile = p ? { elements: profileElements(p), disruptors: p.disruptors } : null;
  } catch (e) {
    out.quality_day_profile = { ERROR: (e as Error).message };
  }
  try {
    // WHAT DAY IS IT FOR THIS MEMBER — the first question behind any wrong-date report, and until now the only
    // way to answer it was to read their zone out of the profile blob and do the arithmetic by hand.
    const { memberZone } = await import('../time/zone-store.ts');
    const { localDate } = await import('../time/member-clock.ts');
    const zone = await memberZone(db, memberId);
    const now = new Date();
    out.member_clock = {
      zone: zone ?? null, // null = never detected; everything falls back to UTC, which is the pre-0078 behaviour
      today: localDate(zone, now),
      utc_today: localDate(null, now),
      // The two disagree for part of every day west of Greenwich. When they do, a date that looks "off by one"
      // is this, and is expected.
      diverged: localDate(zone, now) !== localDate(null, now),
    };
  } catch (e) {
    out.member_clock = { ERROR: (e as Error).message };
  }
  try {
    // WHICH BUILD IS ANSWERING. The operator read and the member's footer must agree — when they don't, the
    // answer is almost always a stale deploy or a stale alias, which has been suspect #1 for "the fix isn't live"
    // more than once. Cheap to report, and it makes that check a glance instead of an investigation.
    const { versionLabel } = await import('../version.ts');
    out.build = versionLabel();
  } catch (e) {
    out.build = { ERROR: (e as Error).message };
  }
  out.jsonb_shape = await jsonbShape(db, memberId);
  out.jsonb_binding = await jsonbBinding(db);
  try {
    // NOT member state — the database's. It rides here because this endpoint is how prod gets inspected at all,
    // and "is the schema this code expects actually present" is the first question behind half the bugs that
    // reach a member (a Quality Days tracker that vanished, a write that reports "please try again").
    const { migrationState } = await import('../db/schema.ts');
    const st = await migrationState(db);
    out.migrations = { applied: st.applied.length, pending: st.pending };
  } catch (e) {
    out.migrations = { ERROR: (e as Error).message };
  }
  return out;
}

/**
 * IS EACH jsonb COLUMN AN OBJECT, OR A STRING THAT LOOKS LIKE ONE?
 *
 * A jsonb column written by JSON.stringify can land as a jsonb SCALAR STRING rather than an object. Every JS
 * reader survives it — they all do `typeof x === 'string' ? JSON.parse(x) : x` — so the value reads correctly in
 * the app and looks fine in a dump. What dies is every predicate that reaches into it FROM SQL:
 * `payload->>'kind' = '…'` on a jsonb string is NULL, so the row silently fails to match and the query returns
 * nothing. No error, no empty-catch, no log — just a filter that can never be true.
 *
 * That is how a member finished Quality Days, had both the profile and the week in the database, and had no
 * tracker: `activeQualityDayProfile` filters on `payload->>'kind'`, matched nothing, returned null, and the grid
 * was dropped by the `rows.length > 0` filter as "a week with nothing to show".
 *
 * `jsonb_typeof` is the only thing that tells them apart, so it goes in the report next to the values. Local
 * PGlite and hosted Postgres do not have to agree here — which is exactly why this cannot be caught locally.
 */
/**
 * HOW DOES THIS DRIVER BIND A jsonb PARAMETER? Read-only, no writes, no member data.
 *
 * Every jsonb value on prod is a scalar STRING and we do not know which link in the chain does it. The theory is
 * that `$n::jsonb` resolves the PARAMETER's type to jsonb, so postgres.js serialises the value it was handed — and
 * we hand it a JSON string, so it is encoded twice. That is a theory, and the last two times I reasoned about this
 * shape instead of measuring it I was wrong in a way that cost hours.
 *
 * So: ask the database, with the exact binding patterns our writes use. Three probes, no mutation, and the answer
 * is unambiguous — `object` means the pattern is fine, `string` means it is the one double-encoding.
 * Delete this once the write is fixed; it exists to settle one question.
 */
async function jsonbBinding(db: Db): Promise<Record<string, unknown>> {
  const payload = JSON.stringify({ probe: true });
  const probes: [string, string, unknown[]][] = [
    // What every one of our writes does today.
    ['cast_stringified', 'select jsonb_typeof($1::jsonb) as t', [payload]],
    // Candidate fix A: force the parameter to TEXT first, so the column/cast parses it rather than the driver.
    ['text_then_cast', 'select jsonb_typeof($1::text::jsonb) as t', [payload]],
    // Control: this MUST be 'string'. If it is not, the probe itself is wrong and nothing here can be trusted.
    ['control_to_jsonb_text', 'select jsonb_typeof(to_jsonb($1::text)) as t', [payload]],
  ];
  const out: Record<string, unknown> = {};
  for (const [label, sql, params] of probes) {
    try {
      const { rows } = await db.query<{ t: string }>(sql, params);
      out[label] = rows[0]?.t ?? null;
    } catch (e) {
      out[label] = { ERROR: (e as Error).message };
    }
  }
  return out;
}

async function jsonbShape(db: Db, memberId: string): Promise<Record<string, unknown>> {
  const cols: [string, string, string][] = [
    ['coaching_plan', 'payload', 'coaching_plan.payload'],
    ['bigger_world_reading', 'priorities', 'bigger_world_reading.priorities'],
    ['bigger_world_reading', 'reflections', 'bigger_world_reading.reflections'],
    ['practice_week', 'payload', 'practice_week.payload'],
  ];
  const out: Record<string, unknown> = {};
  for (const [table, col, label] of cols) {
    try {
      const { rows } = await db.query<{ t: string; n: number }>(
        `select jsonb_typeof(${col}) as t, count(*)::int as n from ${table}
          where member_id = $1 and ${col} is not null group by 1`,
        [memberId],
      );
      if (rows.length) out[label] = Object.fromEntries(rows.map((r) => [r.t, r.n]));
    } catch (e) {
      // A column that doesn't exist on this schema version is not an error worth reporting as one.
      const msg = (e as Error).message;
      if (!/does not exist/i.test(msg)) out[label] = { ERROR: msg };
    }
  }
  return out;
}
