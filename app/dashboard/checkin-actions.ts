'use server';

import { softRead } from '../../lib/db/degrade.ts';
import { memberToday } from '../../lib/time/zone-store.ts';
import { addDays, longDate, shortDate } from '../../lib/time/member-clock.ts';
import { groundToMemberWords } from '../../lib/agent/member-words.ts';
import { getDb } from '../../lib/db/index.ts';
import { heroCard } from '../../lib/dashboard/hero-card.ts';
import { standingUpdate } from '../../lib/dashboard/standing-update.ts';
import { outcomes } from '../../lib/dashboard/outcomes.ts';
import { getDashboard } from '../../lib/gateway/flow.ts';
import {
  checkinOpening,
  checkinReply,
  type CheckinContext,
  type CheckinMessage,
  type ToolExecutor,
  type PracticeWeekCtx,
} from '../../lib/agent/checkin.ts';
import { loadConversation, appendMessages } from '../../lib/agent/conversation.ts';
import { recentConsumedTitles } from '../../lib/bites/store.ts';
import { getReclaimItems } from '../../lib/beats/store.ts';
import { addReclaimItemForMember, addDoorForMember } from '../../lib/member/refine.ts';
import { noteDoorProfile, doorProfile, describeDoorProfile } from '../../lib/reconnect/door-profile.ts';
import { disconnectionContext } from '../../lib/agent/disconnection.ts';
import { loadRaisedNotices, markNoticeRaised } from '../../lib/agent/disconnection-store.ts';
import { markReclaimReclaimedByText, unmarkReclaimReclaimedByText, refineReclaimItemByText, removeReclaimItemByText, reorderReclaimList } from '../../lib/beats/store.ts';
import { proposeEntry, playbookForAgent, isPlaybookSection, listPlaybook, matchKeptEntry, dismissEntry } from '../../lib/playbook/store.ts';
import { createMeasure, logReadingByLabel, updateMeasure, archiveMeasure, measuresForAgent, findReclaimItemId, looksTrackable } from '../../lib/measure/store.ts';
import { logCall, isCallType, isCallDomain, domainTally, recentCalls } from '../../lib/momentum/store.ts';
import { setCommitment, activeCommitments, isCommitmentDomain, DOMAIN_WORD } from '../../lib/commitments/store.ts';
import { logMovement, isMovementKind, movementLogSummary } from '../../lib/movement/store.ts';
import { redesignEnabled } from '../../lib/dashboard/redesign.ts';
import { weekGrids, type WeekGrid } from '../../lib/practice/grid.ts';
import { isClosable, buildReview, closeWeek, keeperBodyFrom, PRACTICE_KEEPER_NAME } from '../../lib/practice/close.ts';
import { harvestSignal } from '../../lib/agent/harvest.ts';
import type { PracticeKind } from '../../lib/practice/store.ts';
import { isTappable, toggleMark } from '../../lib/practice/mark.ts';
import { activePracticeWeek, activePracticeWeeks } from '../../lib/practice/store.ts';
import { recordW3Entry, w3Entries } from '../../lib/rewire/w3-entry.ts';
import { recordB3Entry } from '../../lib/rebuild/b3-entry.ts';
import { w3Triggers } from '../../lib/rewire/w3-triggers.ts';
import { phaseSummary, type PhaseKey } from '../../lib/content/summaries.ts';

const isPhaseKey = (k: string | null): k is PhaseKey =>
  k === 'reconnect' || k === 'rewire' || k === 'rebuild' || k === 'reclaim';
import { rewireEnabled } from '../../lib/agent/rewire.ts';
import { rebuildEnabled } from '../../lib/agent/rebuild.ts';
import { maybeFoldMemory } from '../../lib/agent/memory.ts';
import { asSnapshot, diffSnapshot, type DashboardSnapshot } from '../../lib/agent/changes.ts';
import { getGrinta } from '../../lib/grinta/index.ts';
import { latestGrintaReading } from '../../lib/grinta/survey/store.ts';
import { latestWhyReading, latestSkillsReading } from '../../lib/rebuild/store.ts';
import { skillHighlights } from '../../lib/rebuild/skills-instrument.ts';
import { activeCoachingPlan, type RebuildPilotPayload } from '../../lib/rebuild/plan-store.ts';
import { latestBiggerWorldReading, firstFocus, closingLines } from '../../lib/reclaim/bigger-world-store.ts';
import { AUDIT_DOMAIN_LABEL } from '../../lib/reclaim/bigger-world-instrument.ts';
import { activeQualityDayProfile, recentQualityDays } from '../../lib/reclaim/quality-day-store.ts';
import { listFacets, closedSessionIds } from '../../lib/curriculum/store.ts';
import { getForecast, getPassport } from '../../lib/curriculum/view.ts';
import { getAsset } from '../../lib/curriculum/registry.ts';
import { getDailyBeat } from '../../lib/daily-beat/store.ts';
import { getMemberExperience } from '../../lib/telemetry/store.ts';
import { itemStem, dimensionForIndex } from '../../lib/idq/instrument.ts';
import { getConnectSummaryForAgent } from '../../lib/connect/agent.ts';
import { awayHistory } from '../../lib/outreach/store.ts';
import { foldAwayEpisodes, awayRecallLine } from '../../lib/outreach/episodes.ts';
import { authorizeMember } from '../authz.ts';
import { detectCrisis } from '../../lib/agent/governance.ts';
import { escalateCrisis } from '../../lib/agent/crisis-escalation.ts';
import { logEvent } from '../../lib/telemetry/store.ts';
import type { Db } from '../../lib/db/schema.ts';

// Build the agent's context: dashboard facts + GRINTA! Index/trend + what they've recently read.
// The agent is AWARE of these (to reference naturally); it does not serve content into the chat.
/**
 * A DERIVED FIELD THAT CANNOT TAKE THE WHOLE CONTEXT DOWN.
 *
 * Every supplementary READ in buildContext is already `.catch`-guarded, one field each — that lesson was learned
 * on Jay's earlier walk. The DERIVATIONS built from those reads were not, and they all sat inside one outer try,
 * so a single bad dereference collapsed the entire durable record to `minimal` and the Companion told Jay it could
 * not see his Playbook (2026-08-12). The Playbook read had SUCCEEDED. Something three fields away had not.
 *
 * The blast radius was the bug, not the throw. Each derivation now fails alone, loudly and BY NAME, so the next
 * one costs one signal instead of the member's whole history — and so the log says which one it was.
 */
function derive<T>(label: string, fn: () => T, failures?: string[]): T | null {
  try {
    return fn();
  } catch (e) {
    const msg = `${label}: ${(e as Error)?.message ?? e}`;
    failures?.push(msg);
    console.error(`buildContext derivation FAILED — ${msg}`);
    return null;
  }
}

/**
 * One week grid → the shape the Companion reads. ONE mapper, used for every open week and for the singular
 * "week that needs attention", so those two can never describe the same week differently.
 */
function weekCtx(g: WeekGrid, w3Extras: Parameters<typeof buildReview>[1]): PracticeWeekCtx {
  return {
    kind: g.kind,
    // NAMED, because there can be four. "Day 3 of 7" is meaningless when a member is running Mindful Monitoring,
    // the Lifestyle Pilot and Quality Days at the same time — the Companion has to be able to say which one.
    label: PRACTICE_KEEPER_NAME[g.kind] ?? 'Your practice week',
    day: g.day,
    days: g.window.days,
    rows: g.rows.map((r) => ({
      label: r.label,
      target: r.target,
      done: r.done,
      // Computed HERE, not in the prompt: an agent asked to work out "is today already marked" from a boolean
      // array will sometimes get it wrong and ask them for something they have already done.
      todayDone: r.marks[g.day - 1] === true,
    })),
    tappable: isTappable(g.kind),
    triggers: g.kind === 'w3_logging' ? g.rows.filter((r) => r.slot !== 'logged').map((r) => r.label) : undefined,
    readyToClose: isClosable(g),
    review: isClosable(g) ? (({ opener, lines }) => ({ opener, lines }))(buildReview(g, w3Extras)) : null,
  };
}

async function buildContext(db: Db, memberId: string): Promise<CheckinContext | null> {
  const dash = await getDashboard(db, memberId);
  if (!dash) return null;

  // Momentum + commitments are computed UP FRONT and folded into BOTH the full context AND the `minimal` fallback below.
  // The member's logged calls and standing commitments MUST reach the companion even if a supplementary read degrades
  // the rest of the context — otherwise the companion insists it "can't see your Momentum calls" while they sit right
  // there in the log (Jay's walk: 4 Good Calls logged, companion blind, because the context had collapsed to minimal).
  const momentumCalls = await softRead('checkin.recentCalls', memberId, () => recentCalls(db, memberId, 12), []);
  const activeCmts = await activeCommitments(db, memberId).catch(() => []);
  // THE MEMBER'S date, read once and used for every date decision in this context. Was the server's — which is
  // UTC on Vercel — so after 6pm in Boulder the Companion called a call logged an hour ago "yesterday", and told
  // the member it was already tomorrow.
  const todayISO = await memberToday(db, memberId);
  const yestISO = addDays(todayISO, -1);
  const whenLabel = (iso: string): string =>
    iso === todayISO ? 'today' : iso === yestISO ? 'yesterday' : shortDate(iso);
  // The Companion must speak the label the member SEES. The stored enum is still `quiet_day`; the word is "On Track".
  const CALL_LABEL = { good_call: 'Good Call', false_start: 'False Start', quiet_day: 'On Track' } as const;
  const momentumLog = momentumCalls.length
    ? momentumCalls.map((e) => ({ label: CALL_LABEL[e.type], domain: e.domain ? (DOMAIN_WORD[e.domain] as 'movement' | 'eating') : null, note: e.note, when: whenLabel(e.loggedOn) }))
    : null;
  const commitments = activeCmts.length
    ? activeCmts.map((c) => ({ domain: DOMAIN_WORD[c.domain] as 'movement' | 'eating', text: c.text, serves: c.reclaimItemText }))
    : null;

  // Degrade-not-crash (W-13): the companion is the cornerstone. `dash` is the ESSENTIAL read; everything below is
  // SUPPLEMENTARY context ("the agent knows X"). If ANY supplementary read rejects — e.g. a prod-drifted table, since
  // migrations don't auto-apply — fall back to this minimal-but-valid context instead of throwing. The rail then opens
  // with name + identity + doors + reclaim list (a real opening), NEVER the "something hiccupped" error greeting. Momentum
  // + commitments ride along here too, so the companion never goes blind to logged calls even on a degrade.
  const minimal: CheckinContext = {
    displayName: dash.displayName,
    identityNoun: dash.identityNoun,
    doorDisplayNames: dash.doors.map((d) => d.displayName),
    idScore: dash.score?.score ?? null,
    direction: dash.score?.direction ?? null,
    currentFocus: dash.currentFocus?.label ?? null,
    lastCompletedAsset: null,
    reclaimList: dash.reclaimList,
    reclaimAnchor: dash.reclaimAnchor,
    momentumLog,
    commitments,
    // `today` is ALWAYS supplied, even here in the degraded path. Omitting it let the prompt's "NEVER GUESS THE
    // DATE" instruction fire with no date — risking a mis-dated reading/milestone. (CAT-39) It now costs one
    // indexed read (the member's zone), but memberToday cannot throw: a failed zone read falls back to UTC,
    // which is exactly the behaviour this line had before.
    today: longDate(todayISO),
  };
  try {
  // "best-effort" but was UNGUARDED — and it runs a memory-fold (API/query) BEFORE everything else, so if it threw it
  // sank the entire context to minimal (this is why the companion still couldn't see momentum after the first pass).
  await maybeFoldMemory(db, memberId).catch((e) => console.warn('maybeFoldMemory failed (non-fatal):', (e as Error).message));
  const [grinta, grintaReading, whyReading, skillsReading, pilotPlan, pilotTally, biggerWorld, qdProfile, qdRecent, practiceGrids, doorProfileRows, consumedBites, profRows, idqRows, reclaimItems, beatRows, playbook, measures, linkedMeasureRows, facets, closedIds, lastClosedRows, forecast, experience, passport, outcomeCards] = await Promise.all([
    getGrinta(db, memberId, dash.identityNoun).catch(() => ({ score: null, direction: null }) as unknown as Awaited<ReturnType<typeof getGrinta>>),
    // Rebuild/Reclaim REGISTERS — all SUPPLEMENTARY context ("the agent knows X"), each null-safe downstream. Guard
    // EVERY one with .catch: a single missing/drifted register table (prod migrations don't auto-apply) must NEVER
    // take down the cornerstone companion. Degrade to null → the agent just doesn't know that one signal yet. Empty
    // for a brand-new account anyway, so null == "no data yet." (Matches the QD reads, which were already guarded.)
    latestGrintaReading(db, memberId).catch(() => null), // the SURVEY Grinta Index (Decision DD) — the grit baseline the member sees
    latestWhyReading(db, memberId).catch(() => null), // Rebuild B1 — the agent must KNOW they named their why (RB-1: stored, not shown)
    latestSkillsReading(db, memberId).catch(() => null), // Rebuild B2 — the self-management profile the agent reflects (plain language)
    activeCoachingPlan<RebuildPilotPayload>(db, memberId, 'rebuild').catch(() => null), // Rebuild B3 — the active Lifestyle Pilot plan
    domainTally(db, memberId).catch(() => null), // Rebuild B3 — per-domain call tally (movement vs eating), OO
    latestBiggerWorldReading(db, memberId).catch(() => null), // Reclaim C2 — the member's chosen priorities (primary + momentum lever)
    activeQualityDayProfile(db, memberId).catch(() => null), // Reclaim C3 — the Quality-Day profile
    recentQualityDays(db, memberId).catch(() => []), // Reclaim C3 — recent Quality-Day logs
    weekGrids(db, memberId).catch(() => []), // EVERY open week — a member can be running four at once
    doorProfile(db, memberId).catch(() => []), // Reconnect R2 — what they've said ABOUT their Doors (weight + still-open)

    // These were UNGUARDED — and a single throw here collapsed the WHOLE context to `minimal` (Jay's walk: the
    // companion said it could only see Reclaim List / ID Score / Doors — the minimal fields — because a supplementary
    // read threw and buried momentum, commitments, playbook, everything). Guard EACH so one failure degrades one field,
    // not all of them (CLAUDE.md: wrap dashboard reads to degrade not crash). Empty defaults are downstream-null-safe.
    recentConsumedTitles(db, memberId).catch(() => [] as string[]),
    db.query<{ intake_athletic_past: string | null; intake_gap: string | null; agent_memory: string | null; dashboard_snapshot: unknown }>(
      'select intake_athletic_past, intake_gap, agent_memory, dashboard_snapshot from member_profile where member_id=$1',
      [memberId],
    ).catch(() => ({ rows: [] as never[] })),
    db.query<any>(
      `select sequence_no, id_score, physical_score, self_score, social_score, outlook_score, responses
       from idq_retake where member_id=$1 and cycle_indicator=1 order by sequence_no`,
      [memberId],
    ).catch(() => ({ rows: [] as never[] })),
    getReclaimItems(db, memberId).catch(() => [] as Awaited<ReturnType<typeof getReclaimItems>>),
    // Count only REAL closes. beat_completion also holds onboarding artifacts and 'self_marked' markers
    // (written when a member tells the Companion "I already got that one back") — the same two the member's own
    // Past Beats view hides. Unfiltered, this fed the Companion a number that made it announce "2 new Beats
    // completed" when someone had actually self-marked two Reclaim goals: wrong event AND a retired word.
    // Same filter as getBeatHistory, so the Companion can never disagree with what the member sees.
    db.query<{ n: number }>(
      `select count(*)::int n from beat_completion
        where member_id=$1 and coalesce(close_response,'') not in ('onboarding','self_marked')`,
      [memberId],
    ).catch(() => ({ rows: [] as never[] })),
    playbookForAgent(db, memberId).catch(() => ({ keepers: [], recentNotes: [] }) as Awaited<ReturnType<typeof playbookForAgent>>),
    measuresForAgent(db, memberId).catch(() => [] as Awaited<ReturnType<typeof measuresForAgent>>),
    db.query<{ reclaim_item_id: string }>(
      'select distinct reclaim_item_id from measure where member_id=$1 and reclaim_item_id is not null and archived_at is null',
      [memberId],
    ).catch(() => ({ rows: [] as never[] })),
    listFacets(db, memberId).catch(() => [] as Awaited<ReturnType<typeof listFacets>>),
    closedSessionIds(db, memberId).catch(() => [] as string[]),
    db.query<{ session_id: string }>(
      "select session_id from session_progress where member_id=$1 and status='closed' order by closed_at desc nulls last limit 1",
      [memberId],
    ).catch(() => ({ rows: [] as never[] })),
    getForecast(db, memberId).catch(() => ({ phases: [], current: null }) as unknown as Awaited<ReturnType<typeof getForecast>>),
    getMemberExperience(db, memberId, (id) => getAsset(id)?.title ?? id).catch(() => ({ summary: '' }) as Awaited<ReturnType<typeof getMemberExperience>>),
    // The 16-milestone Passport — the member SEES these badges, so the agent must know them (CAT-37).
    getPassport(db, memberId).catch(() => ({ earned: 0, total: 0, badges: [], placeholders: 0 }) as Awaited<ReturnType<typeof getPassport>>),
    // The three outcome cards the member sees at the head of their Playbook (mindfulness · fitness · wellness).
    // Same read the page uses, so the agent can never disagree with the cards in front of them (CAT-37).
    outcomes(db, memberId).catch(() => []),
  ]);
  // W3 close extras — how many days they used the protocol they wrote. That count lives in the daily entries, not
  // in the grid's marks, and it is the one thing Greg permits an affirmation to target that the grid cannot see.
  // Scoped tightly: fetched ONLY when a W3 week is genuinely ready to close, never on an ordinary turn.
  // FIND the W3 week among however many are open — with four running, "the practice week" is not a thing that
  // exists, and asking whether THE week is W3 silently skipped these extras whenever W3 was not the newest.
  const w3Week = practiceGrids.find((g) => g.kind === 'w3_logging');
  const w3Extras =
    w3Week && isClosable(w3Week)
      ? await w3Entries(db, memberId, 7)
          .then((entries) => ({
            recoveryUsed: entries.filter((e) => e.recoveryUsed === true).length,
            daysLogged: entries.length,
          }))
          .catch(() => null)
      : null;
  const prof = profRows.rows[0];

  // Curriculum awareness — the named selves (identity strip) + completed Sessions, so the companion
  // knows the identity work the member has done (CLAUDE.md: nothing the member sees is invisible to the MA).
  const namedSelves = facets.map((f) => f.text);
  const completedSessions = closedIds.map((id) => getAsset(id)?.title).filter((t): t is string => !!t);
  const lastSessionId = lastClosedRows.rows[0]?.session_id;
  const lastCompletedAsset = lastSessionId ? (getAsset(lastSessionId)?.title ?? null) : null;
  // The R they're in now (for noticing a Checkpoint crossing) + the lit next step (to route them to).
  const activePhase = forecast.phases.find((p) => p.status === "You're here")?.label ?? null;
  const activePhaseKey = forecast.phases.find((p) => p.status === "You're here")?.phase ?? null;
  const nextStep = forecast.current ? { title: forecast.current.title, kind: forecast.current.kind, openable: forecast.current.openable } : null;
  // Today's Daily Beat — so the companion knows the reflection on their dashboard if they bring it up.
  const dailyBeat = (await getDailyBeat(db, memberId, activePhaseKey, todayISO).catch(() => null))?.text ?? null;

  // Pillar 2 — change-detection: diff the member's key signals against the last interaction's
  // snapshot, then persist the new snapshot for next time. So the companion notices what moved.
  const currSnapshot: DashboardSnapshot = {
    idScore: dash.score?.score ?? null,
    grinta: grinta.score ?? null,
    beatsDone: beatRows.rows[0]?.n ?? 0,
    reclaimedItems: reclaimItems.filter((r) => r.state === 'reclaimed').map((r) => r.text),
    measures: Object.fromEntries(measures.map((m) => [m.label, m.latest])),
    closedSessions: completedSessions,
    namedSelves,
    activePhase,
  };
  let recentChanges: ReturnType<typeof diffSnapshot>;
  try {
    recentChanges = diffSnapshot(asSnapshot(prof?.dashboard_snapshot), currSnapshot);
  } catch {
    recentChanges = []; // a malformed stored snapshot must not sink the whole context
  }
  await db
    .query('update member_profile set dashboard_snapshot=$1::text::jsonb, dashboard_snapshot_at=now() where member_id=$2', [
      JSON.stringify(currSnapshot),
      memberId,
    ])
    .catch(() => {});

  // Proactive tracker offer: goals whose wording has a measurable target but no tracker yet.
  const linkedIds = new Set(linkedMeasureRows.rows.map((r) => r.reclaim_item_id));
  const trackableUntracked = reclaimItems
    .filter((i) => i.state !== 'reclaimed' && !linkedIds.has(i.id) && looksTrackable(i.text))
    .map((i) => i.text);

  // Full IDQ data: dimensions + trend + the 24 answers (so the agent can speak to any of it).
  const latest = idqRows.rows[idqRows.rows.length - 1];
  const dimensions = latest
    ? {
        physical: Number(latest.physical_score),
        self: Number(latest.self_score),
        social: Number(latest.social_score),
        outlook: Number(latest.outlook_score),
      }
    : null;
  const idScoreHistory = idqRows.rows.map((r) => Math.round(Number(r.id_score)));

  // ── SOMETHING THAT DOESN'T CONNECT ──────────────────────────────────────────────────────────────────────────
  // The engine half of "hold the whole picture" (WHAT_YOU_ARE_FOR). Everything it needs is already computed above
  // — dimensions, the list with categories, their identity, their commitments — which is the point: this is not
  // new data, it is the comparison nobody was making. See lib/agent/disconnection.ts for why the ENGINE decides
  // whether it is true and the MODEL only decides how to say it.
  const reclaimDetail = reclaimItems.map((r) => ({
    text: r.text, category: r.category, state: r.state, tracked: linkedIds.has(r.id),
  }));
  let disconnectionLine: string | null = null;
  try {
    const raisedAlready = await loadRaisedNotices(db, memberId);
    const found = disconnectionContext({
      dimensions,
      items: reclaimDetail,
      identityNoun: dash.identityNoun ?? null,
      commitments,
      alreadyRaised: raisedAlready,
    });
    if (found) {
      disconnectionLine = found.line;
      await markNoticeRaised(db, memberId, found.raised); // marked on SERVE — see the store's note on that trade
    }
  } catch (e) {
    // If companion_notice is not applied on this database yet, the READ throws and we land here with null: the
    // Companion simply raises nothing. That is the correct failure. The dangerous one would be an empty
    // raised-list read as "never asked", which would re-raise a settled observation on every single turn.
    console.warn('disconnection notice skipped (raising nothing this turn):', (e as Error)?.message);
  }
  const responses: unknown = latest?.responses;
  const idqAnswers = Array.isArray(responses)
    ? responses.map((score: number, i: number) => ({ dimension: dimensionForIndex(i), stem: itemStem(i), score }))
    : [];
  const connect = await getConnectSummaryForAgent(db, memberId).catch(() => undefined);

  // AWAY EPISODES → the Companion's memory of having reached out. Folded pure (lib/outreach/episodes.ts) and
  // carrying its own voice guard, because recall is exactly where praise sneaks in.
  const away = await awayHistory(db, memberId);
  const awayRecall = awayRecallLine(foldAwayEpisodes(away.rows, away.activityAt));
  const movementLog = redesignEnabled() ? await movementLogSummary(db, memberId).catch(() => '') : '';
  // momentumLog + commitments were computed UP FRONT (folded into `minimal` too) — see the top of buildContext.
  return {
    today: longDate(todayISO),
    // Earned badges — member-visible, so agent-visible (CLAUDE.md cornerstone). Names only. (CAT-37)
    earnedBadges: passport.badges.filter((b) => b.earned).map((b) => b.name),
    // The SAME standing update the member is reading above the thread — recomputed here rather than passed in,
    // because this context is built server-side for a turn and must not depend on what the client last rendered.
    standingUpdate: await standingUpdate(db, memberId, await heroCard(db, memberId).catch(() => null)).catch(() => null),
    displayName: dash.displayName,
    identityNoun: dash.identityNoun,
    namedSelves,
    completedSessions,
    nextStep,
    dailyBeat,
    doorDisplayNames: dash.doors.map((d) => d.displayName),
    doorProfileLine: describeDoorProfile(doorProfileRows),
    idScore: dash.score?.score ?? null,
    direction: dash.score?.direction ?? null,
    currentFocus: dash.currentFocus?.label ?? null,
    // The active phase's "why this matters", in the exact words the member sees on the canvas — so the MA shares the
    // framing (CLAUDE.md: nothing the member sees is invisible to the agent). Guarded to the 4 real phase keys.
    currentPhaseWhy: isPhaseKey(activePhaseKey) ? phaseSummary(activePhaseKey).short : null,
    lastCompletedAsset, // most-recently completed curriculum Session (Identity Excavation, …)
    reclaimList: dash.reclaimList,
    reclaimAnchor: dash.reclaimAnchor,
    grintaScore: grinta.score,
    grintaTrend: grinta.direction,
    // The SURVEY Grinta Index (grit baseline → Checkpoints) — the number the member sees on the dashboard card,
    // so the companion knows it too (CLAUDE.md: nothing the member sees is invisible to the MA). Null on prod v1.
    grintaIndex: grintaReading?.composite ?? null,
    grintaStrands: grintaReading?.strands ?? null,
    grintaIndexTrend: grintaReading?.direction ?? null,
    grintaIndexChangePct: grintaReading?.changePct ?? null,
    whyNamed: whyReading != null, // Rebuild B1 done — the agent knows it, never shows the number (RB-1)
    skillProfile: skillsReading ? skillHighlights(skillsReading.scores) : null, // Rebuild B2 — strongest + growth edge (plain language)
    pilotPlan: pilotPlan?.payload ?? null, // Rebuild B3 — the active Lifestyle Pilot (their two committed changes)
    pilotCalls: pilotPlan ? pilotTally : null, // per-domain call tally, only while a pilot is active (OO)
    momentumLog, // computed up front — present here AND in the minimal fallback, so the companion never goes blind to it
    commitments, // ditto — the accountability spine survives a context degrade
    // Reclaim C2 — the member's focus + momentum lever, plus what they said in their own words.
    // `primary` USED TO BE THE COMPUTED PRIMARY while the prompt described it as "the area they chose". That was
    // loose before v3.3 and would now be plainly wrong: the audit asks outright which area they'd move on, and the
    // member's answer can differ from the arithmetic. firstFocus() resolves it their way and reports which it was,
    // so the Companion can say "the one you chose" only when they actually chose it.
    reclaimPriorities: derive('reclaimPriorities', () => biggerWorld
      ? (() => {
          const f = firstFocus(biggerWorld);
          const { keyObstacle, firstAction } = closingLines(biggerWorld);
          return {
            primary: AUDIT_DOMAIN_LABEL[f.domain],
            chosenByMember: f.chosenByMember,
            computed: AUDIT_DOMAIN_LABEL[biggerWorld.priorities.primary],
            secondary: AUDIT_DOMAIN_LABEL[biggerWorld.priorities.secondary],
            momentumLever: AUDIT_DOMAIN_LABEL[biggerWorld.priorities.momentumLever],
            keyObstacle: keyObstacle ?? null,
            firstAction: firstAction ?? null,
          };
        })()
      : null),
    // The grid, as the member reads it. todayDone is computed HERE, not in the prompt: an agent asked to work out
    // "is today already marked" from a boolean array will sometimes get it wrong and ask them for something they've
    // already done — which is the most deflating possible thing for a practice week to do.
    practiceWeeks: derive('practiceWeeks', () => practiceGrids.map((g) => weekCtx(g, w3Extras))) ?? [],
    // THE ONE THAT NEEDS ATTENTION — a finished week first, else the newest. Not a duplicate of the list above:
    // naming every week is a VISIBILITY question, acting on one is a PACING question, and they have different
    // answers. A member with four open weeks should hear about all four and be asked about one.
    //
    // "Finished first" matters precisely BECAUSE several run at once: weeks start on different days, so the one
    // that elapsed is often not the newest — and under the old newest-only read a week could finish and never be
    // reviewed at all.
    practiceWeek: derive('practiceWeek', () => {
      const all = practiceGrids.map((g) => weekCtx(g, w3Extras));
      return all.find((w) => w.readyToClose && w.review) ?? all[0] ?? null;
    }),
    qualityDay: qdProfile
      ? {
          nonNegotiables: qdProfile.nonNegotiables,
          days: qdRecent.length,
          recentAvg: qdRecent.length ? Math.round((qdRecent.reduce((s, r) => s + r.score, 0) / qdRecent.length) * 10) / 10 : null,
        }
      : null, // Reclaim C3 — the Quality-Day profile + recent logged average
    outcomes: outcomeCards,
    consumedBites,
    // The narrative from onboarding — so the agent can reference what the member actually shared,
    // not just the dashboard facts. This is what makes the first interaction feel "it knows me."
    pastSelf: prof?.intake_athletic_past ?? null,
    gapStory: prof?.intake_gap ?? null,
    identityParagraph: dash.identityParagraph ?? null,
    dimensions,
    idScoreHistory,
    idqAnswers,
    reclaimDetail: reclaimDetail,
    movementLog: movementLog || undefined,
    beatsDone: beatRows.rows[0]?.n ?? 0,
    playbookKeepers: playbook.keepers,
    playbookNotes: playbook.recentNotes,
    measures,
    trackableUntracked,
    agentMemory: prof?.agent_memory ?? null,
    recentChanges,
    experienceSummary: experience.summary || null,
    connect,
    // Times they have been away and come back. Sits INSIDE the same try as the other supplementary reads, so
    // a failure here degrades the context honestly (CAT-38) rather than silently telling the Companion it has
    // never reached out — which would be a confident false memory about whether we showed up.
    awayRecall,
    // SOMETHING THAT DOESN'T CONNECT — the engine half of WHAT_YOU_ARE_FOR's "hold the whole picture". Computed
    // deterministically (lib/agent/disconnection.ts) and marked raised on serve, so it is offered once and their
    // answer settles it. `softRead` on purpose: if companion_notice has not been applied on this database yet,
    // the read fails, we get null, and the Companion simply does not raise anything — the WRONG failure would be
    // an empty raised-list read as "never asked", which would re-raise a settled observation every session.
    disconnection: disconnectionLine,
  };
  } catch (e) {
    // A supplementary read threw (prod drift / transient). Serve the minimal context so the cornerstone never 500s.
    // CAT-38: FLAG IT. Minimal drops the durable record — story, Playbook, IDQ detail, Grinta — while the system
    // prompt (rightly) forbids denying that we remember the member. Unflagged, the agent's only options were to
    // confabulate specifics or go blandly generic. The flag lets it say "I'm not pulling everything up this
    // minute" without ever claiming memory doesn't persist.
    // RECORD IT WHERE IT CAN BE READ. A console line on a serverless instance answered nobody: Jay hit this twice
    // and both diagnoses were guesswork off a screenshot. The message goes into the member's event stream, which
    // the diagnostic already surfaces — so "why is the Companion blind" costs one call instead of an afternoon.
    // Never blocks the fallback: a telemetry write must not be able to make a bad state worse.
    const why = (e as Error)?.message ?? String(e);
    console.warn('buildContext degraded to minimal — a supplementary read failed:', why);
    void logEvent(db, memberId, 'context_degraded', { surface: 'companion', meta: { message: why.slice(0, 400) } })
      .catch(() => {});
    return { ...minimal, degraded: true };
  }
}

/** Open the companion: the saved thread, or generate + persist a first opening. */
export async function openCheckin(memberId: string): Promise<CheckinMessage[]> {
  if (!(await authorizeMember(memberId))) return [];
  try {
    const db = (await getDb()) as unknown as Db;
    const history = await loadConversation(db, memberId);
    if (history.length > 0) return history; // pick up where we left off
    const ctx = await buildContext(db, memberId);
    if (!ctx) return [{ role: 'agent', text: "I can't reach your profile right now — try reopening in a moment." }];
    const opening = await checkinOpening(ctx);
    await appendMessages(db, memberId, [{ role: 'agent', text: opening }]);
    return [{ role: 'agent', text: opening }];
  } catch (e) {
    console.error('openCheckin failed:', (e as Error).message);
    return [{ role: 'agent', text: "I'm here. Something hiccupped loading our thread — say hello and we'll pick it up." }];
  }
}

/** Read-only: the member's saved thread (no new turn). Used to keep open devices in sync. */
export async function loadCheckin(memberId: string): Promise<CheckinMessage[]> {
  if (!(await authorizeMember(memberId))) return [];
  try {
    const db = (await getDb()) as unknown as Db;
    return await loadConversation(db, memberId);
  } catch {
    return [];
  }
}

/** One member turn: reply with continuity (loads recent thread server-side) and persist both sides. */
export async function sendCheckin(memberId: string, memberMessage: string): Promise<{ reply: string; crisis?: boolean; mutated?: boolean }> {
  if (!(await authorizeMember(memberId))) return { reply: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    // GOVERNANCE — ESCALATE TO A HUMAN (see lib/agent/crisis-escalation.ts). The reply itself is already
    // handled downstream by the engine's own detectCrisis short-circuit; this records the event and alerts a
    // human, which is the half of the rule that did not exist before 2026-08-07. Same predicate as the engine.
    if (detectCrisis(memberMessage).flagged) {
      await escalateCrisis(db, memberId, { surface: 'companion', message: memberMessage });
    }
    const ctx = await buildContext(db, memberId);
    if (!ctx) return { reply: "I can't reach your profile right now — try again in a moment." };
    const history = (await loadConversation(db, memberId)).slice(-40); // bound the agent context (deeper recall)
    // The member can ask the agent to tend their own records — additive only, guarded in the store.
    let mutated = false; // a successful tool write → signal the client to refresh the dashboard panels
    const executor: ToolExecutor = async (name, input) => {
      if (name === 'add_reclaim_item') {
        const res = await addReclaimItemForMember(db, memberId, String(input.text ?? ''), typeof input.category === 'string' ? input.category : undefined);
        if (res.ok) {
          mutated = true;
          const trackNudge = looksTrackable(res.text)
            ? ' This goal has a measurable number in it — consider OFFERING to set up a tracker for it (ask first, never force).'
            : '';
          // THE FOG NOTE IS GONE (2026-08-16, second half). It existed only to warn the model that an
          // inner-state item would never bind to a goal close — a consequence of the filter in
          // lib/beats/serves.ts, which is now removed. Keeping it would make it a LIE: these items bind
          // like any other now. A note describing behaviour we no longer have is worse than no note,
          // because the model acts on it. One fact, one site.
          return { ok: true, message: `Saved "${res.text}" to their Reclaim List (category: ${res.category}). It now shows on their dashboard and the Beat engine can work toward it — acknowledge it briefly and warmly.${trackNudge}` };
        }
        if (res.reason === 'duplicate') {
          return { ok: false, message: 'Not saved — that is already on their Reclaim List. Let them know it is already there.' };
        }
        return { ok: false, message: 'Not saved — no text was provided.' };
      }
      if (name === 'add_door') {
        const res = await addDoorForMember(db, memberId, String(input.description ?? ''));
        if (res.ok) {
          mutated = true;
          return { ok: true, message: `Recorded Door(s): ${res.added.join(', ')}. Name it back gently as recognition; it now shows on their dashboard.` };
        }
        if (res.reason === 'already') {
          return { ok: false, message: 'Not saved — that Door is already recorded for them.' };
        }
        return { ok: false, message: "Couldn't map that to one of the Doors. Reflect what they said and ask a little more about what happened, then try again." };
      }
      if (name === 'note_door_detail') {
        // R2's profile. noteDoorProfile refuses a Door they don't hold, so a wrong slug is a no-op — the model is
        // told plainly rather than left to assume it landed. `mutated` is NOT set: nothing on the dashboard
        // changes, and flagging a refresh would imply to the member that something visibly did.
        const touched = await noteDoorProfile(db, memberId, [{
          slug: String(input.door ?? ''),
          relevance: typeof input.relevance === 'number' ? input.relevance : null,
          openedFirst: typeof input.opened_first === 'boolean' ? input.opened_first : null,
          biggestImpact: typeof input.biggest_impact === 'boolean' ? input.biggest_impact : null,
          stillOpen: typeof input.still_open === 'boolean' ? input.still_open : null,
        }]);
        if (touched) {
          // No "tell them it's saved". This is a detail they let slip about their own life, not a list item they
          // asked to keep — announcing the record turns a confidence into a transaction.
          return { ok: true, message: 'Noted. Stay with what they said; do not mention that it was recorded.' };
        }
        return { ok: false, message: "Not recorded — that isn't one of their Doors, or nothing specific was given. Don't retry; just keep listening." };
      }
      if (name === 'mark_reclaim_reclaimed') {
        // Hard confirm gate (code, not just prompt): a goal can't be flipped on a passing mention.
        if (input.confirmed !== true) {
          return { ok: false, message: 'Not marked yet — confirm with the member first ("Want me to mark that one reclaimed?"), then call again with confirmed=true.' };
        }
        const res = await markReclaimReclaimedByText(db, memberId, String(input.item ?? ''));
        if (res.ok) {
          mutated = true;
          return { ok: true, message: `Marked "${res.text}" reclaimed — it now shows a check on their Reclaim List, one more piece of their Comeback. Acknowledge it warmly; this is a real milestone.` };
        }
        if (res.reason === 'nomatch') {
          return { ok: false, message: "Couldn't find that item on their Reclaim List. Reflect what they said and ask which item they mean, then try again." };
        }
        return { ok: false, message: 'Not marked — no item reference was provided.' };
      }
      if (name === 'refine_reclaim_item') {
        const res = await refineReclaimItemByText(
          db,
          memberId,
          String(input.item ?? ''),
          String(input.text ?? ''),
          typeof input.category === 'string' ? input.category : undefined,
        );
        if (res.ok) {
          mutated = true;
          const refineTrackNudge = res.newText && looksTrackable(res.newText)
            ? ' It now has a measurable number — if there is no tracker on it yet, consider OFFERING to set one up (ask first).'
            : '';
          return { ok: true, message: `Updated their Reclaim List item to "${res.newText}" (kept its progress). Reflect the new wording back so they know it took.${refineTrackNudge}` };
        }
        if (res.reason === 'duplicate') {
          return { ok: false, message: 'Not changed — that wording matches another item already on their list.' };
        }
        if (res.reason === 'nomatch') {
          return { ok: false, message: "Couldn't find the item they want to reword — ask which one they mean." };
        }
        return { ok: false, message: 'Not changed — need both the current item and the new wording.' };
      }
      if (name === 'unmark_reclaim_reclaimed') {
        const res = await unmarkReclaimReclaimedByText(db, memberId, String(input.item ?? ''));
        if (res.ok) {
          mutated = true;
          return { ok: true, message: `Set "${res.text}" back to in progress. Acknowledge it simply — no fuss.` };
        }
        if (res.reason === 'not_self_marked') {
          return { ok: false, message: "That one wasn't a self-mark (it was earned through the work), so there's nothing to undo here." };
        }
        if (res.reason === 'nomatch') {
          return { ok: false, message: "Couldn't find that item — ask which one they mean." };
        }
        return { ok: false, message: 'Nothing to undo — no item reference was provided.' };
      }
      if (name === 'remove_reclaim_item') {
        const res = await removeReclaimItemByText(db, memberId, String(input.item ?? ''));
        if (res.ok) {
          mutated = true;
          return { ok: true, message: `Removed "${res.removedText}" from their Reclaim List — set aside, not destroyed (reversible). Acknowledge it warmly and recovery-first, e.g. "Done — I took ${res.removedText} off your Reclaim List. We can bring it back any time you want." NEVER frame it as a setback.` };
        }
        if (res.reason === 'nomatch') {
          return { ok: false, message: "Couldn't find that item on their Reclaim List — ask which one they mean, then try again." };
        }
        return { ok: false, message: 'Not removed — no item reference was provided.' };
      }
      if (name === 'reorder_reclaim_list') {
        const order = Array.isArray(input.order) ? (input.order as unknown[]).map((x) => String(x ?? '')) : [];
        const res = await reorderReclaimList(db, memberId, order);
        if (res.ok) {
          mutated = true;
          return { ok: true, message: 'Reordered their Reclaim List — it now shows in the new order on their dashboard. Confirm it simply.' };
        }
        if (res.reason === 'nomatch') {
          return { ok: false, message: "Couldn't match those to items on their list — reflect the current list and ask how they'd like it ordered." };
        }
        return { ok: false, message: 'Not reordered — no order was provided.' };
      }
      if (name === 'propose_playbook_entry') {
        const section = String(input.section ?? '');
        const proposed = String(input.body ?? '').trim();
        if (!isPlaybookSection(section) || section === 'journal' || !proposed) {
          return { ok: false, message: 'Not saved — a valid section (what_works | why_works | own_words) and body are required.' };
        }
        // THE ENGINE GROUNDS IT TO WHAT THEY ACTUALLY TYPED — the prompt asks, this enforces.
        //
        // Jay, 2026-08-12: the Companion offered to keep a sentence it had WRITTEN — "Visualization Sessions are
        // feeding my fast rides and PRs — and those are killing the cravings. The loop is real." — in first person,
        // as his. He confirms it and his own record now holds a line he never said. The propose→confirm gate makes
        // that survivable, not right: a member approving our sentence is not the same as us keeping theirs.
        //
        // why_works is EXEMPT and that is deliberate: it holds a piece of the program's science that landed for
        // them, which was never going to be their phrasing. The other two are claims about what they said, so they
        // have to be. If we cannot find it in their words, we do not quietly store ours — we hand it back and ask
        // the model to quote them. See lib/agent/member-words.ts and [[their-own-words-back]].
        let body = proposed;
        if (section !== 'why_works') {
          const said = [...history.filter((m) => m.role === 'member').map((m) => m.text), memberMessage];
          const g = groundToMemberWords(proposed, said);
          if (g.grounded === 'none') {
            return {
              ok: false,
              message:
                'Not saved — that wording is yours, not theirs. Their Playbook holds what THEY said. Quote the ' +
                'strongest single thing they actually typed (you may fix spelling/punctuation and trim a lead-in), ' +
                'and propose that instead. If nothing they said carries it yet, ask them how they would put it.',
            };
          }
          body = g.text;
        }
        const confirmed = input.confirmed === true;
        const r = await proposeEntry(db, memberId, {
          section,
          body,
          keep: confirmed,
          source: { kind: 'checkpoint', label: typeof input.source_label === 'string' ? input.source_label : undefined },
        });
        mutated = true;
        return confirmed
          ? { ok: true, message: `Kept "${r.entry.body}" in their Playbook (${section}). Acknowledge it briefly and warmly.` }
          : { ok: true, message: `Proposed "${r.entry.body}" to their Playbook (${section}) — it's waiting there for them to keep or dismiss. Mention it lightly; don't oversell.` };
      }
      if (name === 'create_measure') {
        const label = String(input.label ?? '').trim();
        const reclaimRef = typeof input.reclaim_item === 'string' ? input.reclaim_item : '';
        const reclaimItemId = reclaimRef ? await findReclaimItemId(db, memberId, reclaimRef) : null;
        const res = await createMeasure(db, memberId, {
          label,
          unit: typeof input.unit === 'string' ? input.unit : undefined,
          direction: input.direction === 'up' || input.direction === 'down' ? input.direction : undefined,
          startValue: typeof input.start_value === 'number' ? input.start_value : null,
          targetValue: typeof input.target_value === 'number' ? input.target_value : null,
          reclaimItemId,
        });
        if (res.ok) {
          mutated = true;
          const linked = reclaimItemId ? ' It shows next to that goal on their dashboard.' : ' It shows on their dashboard.';
          return { ok: true, message: `Started tracking "${res.label}".${linked} Tell them it's set and they can log readings here or on the card.` };
        }
        if (res.reason === 'duplicate') {
          return { ok: false, message: `Not created — they already have a measure called "${label}". Log a reading on it instead.` };
        }
        return { ok: false, message: 'Not created — a label is required.' };
      }
      if (name === 'log_reading') {
        const value = typeof input.value === 'number' ? input.value : Number(input.value);
        const res = await logReadingByLabel(
          db,
          memberId,
          String(input.measure ?? ''),
          value,
          typeof input.date === 'string' ? input.date : undefined,
        );
        if (res.ok) {
          mutated = true;
          return { ok: true, message: `Logged ${res.value} for "${res.label}". It's on their dashboard now — reflect on the movement warmly, never grade the number.` };
        }
        if (res.reason === 'nomatch') {
          return { ok: false, message: "Couldn't find a measure by that name. If they want to start tracking it, use create_measure first." };
        }
        return { ok: false, message: 'Not logged — that reading was not a number.' };
      }
      if (name === 'update_tracker') {
        // #79 — member-confirmed edit to a tracker's target/direction. Their tracker; never a silent change.
        const target = typeof input.target_value === 'number' ? input.target_value : Number(input.target_value);
        const patch: { targetValue?: number | null; direction?: 'down' | 'up' } = {};
        if (Number.isFinite(target)) patch.targetValue = target;
        if (input.direction === 'up' || input.direction === 'down') patch.direction = input.direction;
        const res = await updateMeasure(db, memberId, String(input.measure ?? ''), patch);
        if (res.ok) {
          mutated = true;
          return { ok: true, message: `Updated "${res.label}". Reflect the change back in their words — it's their tracker, the new target is theirs.` };
        }
        if (res.reason === 'nochange') return { ok: false, message: 'Nothing to change — ask what they want the new target to be, then call it again.' };
        return { ok: false, message: "Couldn't find a tracker by that name to update." };
      }
      if (name === 'retire_play') {
        // Makes the Playbook's own promise true — "when something stops working, tell your Companion and change
        // it". Without this the page printed a capability the Companion did not have.
        //
        // A RETIRE, not a delete: state goes to 'dismissed', the row and its history stay, and it can come back.
        // And it REFUSES on an ambiguous name rather than picking — retiring the wrong play is a silent edit to
        // the member's own operating manual, which they may not notice for weeks. The messages below are read by the
        // MODEL and paraphrased to the member, so they say Move, not "play" (Cowork addendum, 2026-08-14).
        const phrase = String(input.play ?? '').trim();
        if (!phrase) return { ok: false, message: 'Not retired — ask which Move they mean, then call it again.' };
        const all = await listPlaybook(db, memberId);
        const { entry, ambiguous } = matchKeptEntry(all, phrase);
        if (ambiguous) {
          return { ok: false, message: 'More than one Move matches that. Ask which one they mean — name them back — then call it again. Do not guess.' };
        }
        if (!entry) return { ok: false, message: "Couldn't find a kept Move by that name. Ask them to say which one, in their words." };
        const done = await dismissEntry(db, memberId, entry.id);
        if (!done) return { ok: false, message: 'Not retired — try once more, or tell them it did not save.' };
        mutated = true;
        return { ok: true, message: `Retired "${entry.body.slice(0, 60)}" — it is kept and can come back anytime. Reflect it back plainly; a Move that stopped working is information, never a failure.` };
      }
      if (name === 'retire_tracker') {
        // #79 — retire (archive) a tracker: kept as history + restorable, NEVER a hard delete.
        const res = await archiveMeasure(db, memberId, String(input.measure ?? ''));
        if (res.ok) {
          mutated = true;
          return { ok: true, message: `Retired "${res.label}" — its history is kept and it can come back anytime. Acknowledge it warmly; retiring a tracker is never a failure.` };
        }
        return { ok: false, message: "Couldn't find a tracker by that name to retire." };
      }
      if (name === 'mark_practice_day') {
        // The grid tells the member "or just tell me and I'll mark it". This is what makes that true — without it
        // the UI prints a promise the Companion cannot keep.
        const label = typeof input.commitment === 'string' ? input.commitment.trim() : '';
        if (!label) return { ok: false, message: 'Not marked — no commitment was named.' };
        // THE COMMITMENT NAMES ITS WEEK — not "the newest week", which is what this used to assume.
        //
        // With four weeks open (Jay's, and intended), matching only against the NEWEST week's commitments meant a
        // member saying "did my walk" was told it "doesn't match anything on their week" whenever the walk lived
        // in an older one. A refusal that reads as though we lost their commitment. Same shape as the grid tap
        // that used to cross-write: the thing the member addressed decides the week, never recency.
        const open = (await activePracticeWeeks(db, memberId)).filter((w) => isTappable(w.kind));
        if (!open.length) {
          const anyOpen = await activePracticeWeek(db, memberId);
          return {
            ok: false,
            message: anyOpen
              ? "Their open week mirrors a log they keep themselves — point them to it rather than marking it here."
              : 'Not marked — no practice week is open right now.',
          };
        }
        // Match the label the model passed against their real commitments, ACROSS every tappable week. Loose but
        // ANCHORED: exact, then prefix, then containment — never a fuzzy nearest-neighbour, because marking the
        // WRONG commitment is a quiet lie about their week and they may never notice it.
        const { rows: commitments } = await db.query<{ slot: string; label: string; kind: string }>(
          'select slot, label, kind from practice_commitment where member_id=$1 and kind = any($2::text[])',
          [memberId, open.map((w) => w.kind)],
        );
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        const want = norm(label);
        const hit =
          commitments.find((c) => norm(c.label) === want) ??
          commitments.find((c) => norm(c.label).startsWith(want) || want.startsWith(norm(c.label))) ??
          commitments.find((c) => norm(c.label).includes(want) || want.includes(norm(c.label)));
        if (!hit) {
          return { ok: false, message: `Not marked — "${label}" doesn't match anything on their open weeks. Ask which one they mean rather than guessing.` };
        }
        // AMBIGUITY REFUSES. Two weeks can hold a similar label, and picking one would silently mark a day on a
        // week the member was not talking about — invisible to them, and wrong in their own record.
        const sameLabel = commitments.filter((c) => norm(c.label) === norm(hit.label));
        if (sameLabel.length > 1) {
          return { ok: false, message: `More than one of their weeks has a "${hit.label}". Ask which week they mean — name them — then call it again. Do not guess.` };
        }
        const pw = open.find((w) => w.kind === hit.kind);
        if (!pw) return { ok: false, message: 'Not marked — that week is no longer open.' };
        const res = await toggleMark(db, memberId, pw, hit.slot, pw.day - 1, 'companion');
        if (!res.ok) return { ok: false, message: res.error ?? 'Not marked.' };
        if (res.on === false) {
          // toggleMark is a TOGGLE: if today was already marked it just un-marked it. Put it straight back — the
          // member said they DID the thing, and "I did my walk" must never quietly erase the tick they already had.
          await toggleMark(db, memberId, pw, hit.slot, pw.day - 1, 'companion');
          return { ok: true, message: `That was already marked for today — nothing changed. Acknowledge it warmly and don't make them repeat themselves.` };
        }
        mutated = true;
        // NAME THE WEEK back. With several running, "marked it" leaves the member to work out which — and the
        // whole reason the grid names its own week is that guessing here is invisible to them.
        const weekName = PRACTICE_KEEPER_NAME[hit.kind as PracticeKind] ?? 'their week';
        return { ok: true, message: `Marked "${hit.label}" done for today on ${weekName}. Reflect it back briefly and warmly, naming the week so they know which — noticing, never a score.` };
      }
      if (name === 'record_w3_day') {
        // W3's log is written by CONVERSATION — Greg makes the daily check-in the primary interface, so this is the
        // Companion writing down what the member just said, not ticking a box on their behalf. Guarded to an open
        // W3 week: outside it, there is nothing to record and the tool should not have been offered at all.
        const pw = await activePracticeWeek(db, memberId);
        if (!pw || pw.kind !== 'w3_logging') {
          return { ok: false, message: 'Not recorded — their monitoring week is not open right now.' };
        }
        const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
        // The trigger arrives as a LABEL (their own words, as the model saw them in context). Resolve it to the
        // stored slot; anything unrecognised becomes 'new', which is a first-class answer in Greg's spec — never a
        // silent drop, and never a guess at which named trigger they meant.
        const named = await w3Triggers(db, memberId);
        const rawTrigger = str(input.trigger);
        const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        const triggerSlot = rawTrigger
          ? (named.find((t) => norm(t.label) === norm(rawTrigger))?.slot ??
             named.find((t) => norm(t.label).includes(norm(rawTrigger)) || norm(rawTrigger).includes(norm(t.label)))?.slot ??
             'new')
          : undefined;
        const wrote = await recordW3Entry(db, memberId, {
          goodCalls: str(input.good_calls),
          falseStarts: str(input.false_starts),
          triggerSlot,
          oldVoice: str(input.old_voice),
          recoveryUsed: typeof input.recovery_used === 'boolean' ? input.recovery_used : undefined,
          reflection: str(input.reflection),
        });
        if (!wrote) return { ok: false, message: "Nothing to record yet — they haven't said what today held." };
        mutated = true;
        // The acknowledgement instruction carries Greg's affirmation rule, because this is the exact moment it gets
        // broken: affirmations must target CONSISTENCY OF TRACKING, honesty of observation, and use of the recovery
        // skill — never the absence of false starts. "Great, you avoided False Starts today!" is disallowed outright.
        return {
          ok: true,
          message:
            "Recorded for today. Reflect it back briefly in their own words. Affirm the NOTICING — that they tracked " +
            "it honestly, or used their recovery move — never the absence of a false start, and never a tally. A false " +
            "start is data, not failure: meet it as evenly as a good call, with no consoling and no reframe rushed on top.",
        };
      }
      if (name === 'record_b3_day') {
        // B3's Lifestyle Pilot week, written by CONVERSATION — the same path as record_w3_day, because Greg's two
        // Engineering Memos are one spec. Guarded to an open b3_pilot week: outside it there is nothing to record.
        //
        // NOT gated on the W3 week and not sharing its guard — a member can legitimately be running both, so a
        // shared "is a monitoring week open" check would let a B3 entry land during a W3-only week.
        const weeks = await weekGrids(db, memberId).catch(() => []);
        if (!weeks.some((w) => w.kind === 'b3_pilot')) {
          return { ok: false, message: 'Not recorded — their Lifestyle Pilot week is not open right now.' };
        }
        const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
        const wrote = await recordB3Entry(db, memberId, {
          goodCalls: str(input.good_calls),
          falseStarts: str(input.false_starts),
          contributed: str(input.contributed),
          obstacles: str(input.obstacles),
          thoughts: str(input.thoughts),
          fuelToMove: str(input.fuel_to_move),
          reflection: str(input.reflection),
        });
        if (!wrote) return { ok: false, message: "Nothing to record yet — they haven't said what today held." };
        mutated = true;
        // Greg's affirmation rule, at the exact moment it gets broken. Affirm the TRACKING and the honesty of the
        // observation — never the absence of a False Start, and never a tally. "Great, no false starts today!" is
        // disallowed outright: it makes the next honest entry cost something.
        return {
          ok: true,
          message:
            'Recorded for today. Reflect it back briefly in their own words. Affirm the NOTICING — that they ' +
            'tracked it honestly — never the absence of a False Start, and never a count. A False Start is data, ' +
            'not failure: meet it as evenly as a Smart Choice, with no consoling and no reframe rushed on top.',
        };
      }
      if (name === 'log_call') {
        // Momentum logging (REWIRE-gated). A call is self-monitoring, never scored; a false start is honest data.
        if (!rewireEnabled()) return { ok: false, message: 'Not available.' };
        const type = input.type;
        if (!isCallType(type)) return { ok: false, message: 'Not logged — that was not a recognizable call type.' };
        const note = typeof input.note === 'string' ? input.note : undefined;
        // Optional activity/diet tag (Decision OO) — only during the Rebuild pilot; quiet days are never domain-tagged.
        const domain = type !== 'quiet_day' && isCallDomain(input.domain) ? input.domain : undefined;
        await logCall(db, memberId, { type, note, domain, source: 'rail' });
        mutated = true;
        const ack =
          type === 'false_start'
            ? // Slice 3 — the false-start → protocol loop (the marquee): meet the slip with their OWN protocol.
              "Logged as a false start — that's honest data, not a mark against them. Meet it warmly, then OFFER (never " +
              "force) to run their protocol: their recovery move / False Start Protocol keeper (in MEMBER CONTEXT), in " +
              "their own words — Redirect, Reframe, Restart. If they have no such keeper, just a warm ack, no phantom protocol."
            : type === 'good_call'
              ? "Logged as a good call. Mark it lightly — it's on their Momentum now."
              : "Logged as on track. No pressure — a steady day counts too.";
        return { ok: true, message: ack };
      }
      if (name === 'log_movement') {
        // Movement logging (REDESIGN-gated) — an off-device activity the member did, from conversation. Source 'companion'.
        if (!redesignEnabled()) return { ok: false, message: 'Not available.' };
        const kind = input.activity_type;
        if (!isMovementKind(kind)) return { ok: false, message: 'Not logged — that was not a recognizable activity type.' };
        const note = typeof input.note === 'string' ? input.note : undefined;
        const on = typeof input.date === 'string' ? input.date : undefined;
        await logMovement(db, memberId, { activityType: kind, note, occurredOn: on, source: 'companion' });
        mutated = true;
        return { ok: true, message: `Logged their ${kind} to their Movement history. Reflect it back warmly — name what they did and what it says about who they're becoming; never a bare number or a grade.` };
      }
      if (name === 'set_commitment') {
        // First-class commitments (REBUILD-gated) — the member names/updates a standing movement/eating change they
        // hold themselves to, laddered to the Reclaim outcome it serves. This is the durable home the old B3 artifact
        // kept losing; the SET path is not swallowed (setCommitment throws on empty).
        if (!rebuildEnabled()) return { ok: false, message: 'Not available.' };
        const domain = input.domain;
        if (!isCommitmentDomain(domain)) return { ok: false, message: 'Not saved — a commitment must be activity (movement) or diet (eating).' };
        const text = typeof input.text === 'string' ? input.text.trim() : '';
        if (!text) return { ok: false, message: 'Not saved — keep coaching until the change is specific, then call it again.' };
        // Optional ladder link: resolve the "serves" wording to one of their Reclaim items (fuzzy; null if no match).
        const serves = typeof input.serves === 'string' ? input.serves.trim() : '';
        const reclaimItemId = serves ? await findReclaimItemId(db, memberId, serves).catch(() => null) : null;
        try {
          await setCommitment(db, memberId, domain, text, 'companion', reclaimItemId);
          mutated = true;
          return {
            ok: true,
            message: `Saved their ${DOMAIN_WORD[domain]} commitment${reclaimItemId ? ', linked to the Reclaim outcome it serves' : ''}. Reflect it back in their OWN words as the thing they've chosen to hold themselves to${reclaimItemId ? ', and tie it to what they said they want' : ''} — never grade it, never praise; name it as theirs.`,
          };
        } catch {
          return { ok: false, message: 'Something went wrong saving that — ask them to say it once more.' };
        }
      }
      return { ok: false, message: 'Unknown tool.' };
    };
    const r = await checkinReply(ctx, history, memberMessage, executor);
    await appendMessages(db, memberId, [
      { role: 'member', text: memberMessage },
      { role: 'agent', text: r.reply },
    ]);
    // THE WEEK ENDS HERE. If this turn carried the close review, mark the week closed and keep it — so it is
    // reviewed exactly once, and the member has it in their Playbook afterwards rather than only in a chat scroll.
    //
    // Closing AFTER the reply, not before, is deliberate: if the turn had thrown, the week would still be open and
    // they would get the review next time. Late is recoverable; a week that closed unseen is not.
    //
    // Independent try, and it LOGS. A keeper that throws must not take the close with it, and a close that throws
    // must not take the member's reply with it — that shared-swallowed-try shape is what silently dropped every
    // session keeper on prod once already.
    const finishing = ctx.practiceWeek;
    if (finishing?.readyToClose && finishing.review) {
      try {
        const closed = await closeWeek(db, memberId, finishing.kind as PracticeKind);
        if (closed) {
          await harvestSignal(
            db,
            memberId,
            {
              kind: 'practice_week',
              ref: finishing.kind,
              keeperType: 'plan',
              destinationIntent: 'keeper',
              payloadRef: keeperBodyFrom(finishing.review.lines, finishing.kind as PracticeKind),
              label: PRACTICE_KEEPER_NAME[finishing.kind as PracticeKind] ?? 'Your practice week',
            },
            'companion',
          );
        }
      } catch (e) {
        console.error(`practice-week close failed for member=${memberId} kind=${finishing.kind}:`, e);
      }
    }
    return { ...r, mutated };
  } catch (e) {
    console.error('sendCheckin failed:', (e as Error).message);
    return {
      reply:
        "I'm having a moment on my end — try again shortly. If something feels urgent, please reach out to someone you trust, or call or text 988.",
    };
  }
}

/** "Run it again" from the Playbook → record the re-run, so a play can show how often the member reaches back for it
 *  ("come back to this 3 times"). Auth-gated, fire-safe. ref = the Session id the Companion re-runs. */
export async function logPlayRerun(memberId: string, sessionId: string): Promise<void> {
  if (!(await authorizeMember(memberId))) return;
  const db = (await getDb()) as unknown as Db;
  await logEvent(db, memberId, 'play_rerun', { surface: 'playbook', ref: sessionId }).catch(() => {});
}
