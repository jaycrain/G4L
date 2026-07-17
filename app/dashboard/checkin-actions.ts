'use server';

import { getDb } from '../../lib/db/index.ts';
import { getDashboard } from '../../lib/gateway/flow.ts';
import {
  checkinOpening,
  checkinReply,
  type CheckinContext,
  type CheckinMessage,
  type ToolExecutor,
} from '../../lib/agent/checkin.ts';
import { loadConversation, appendMessages } from '../../lib/agent/conversation.ts';
import { recentConsumedTitles } from '../../lib/bites/store.ts';
import { getReclaimItems } from '../../lib/beats/store.ts';
import { addReclaimItemForMember, addDoorForMember } from '../../lib/member/refine.ts';
import { markReclaimReclaimedByText, unmarkReclaimReclaimedByText, refineReclaimItemByText, removeReclaimItemByText, reorderReclaimList } from '../../lib/beats/store.ts';
import { proposeEntry, playbookForAgent, isPlaybookSection } from '../../lib/playbook/store.ts';
import { createMeasure, logReadingByLabel, measuresForAgent, findReclaimItemId, looksTrackable } from '../../lib/measure/store.ts';
import { logCall, isCallType, isCallDomain, domainTally } from '../../lib/momentum/store.ts';
import { logMovement, isMovementKind, movementLogSummary } from '../../lib/movement/store.ts';
import { redesignEnabled } from '../../lib/dashboard/redesign.ts';
import { rewireEnabled } from '../../lib/agent/rewire.ts';
import { maybeFoldMemory } from '../../lib/agent/memory.ts';
import { asSnapshot, diffSnapshot, type DashboardSnapshot } from '../../lib/agent/changes.ts';
import { getGrinta } from '../../lib/grinta/index.ts';
import { latestGrintaReading } from '../../lib/grinta/survey/store.ts';
import { latestWhyReading, latestSkillsReading } from '../../lib/rebuild/store.ts';
import { skillHighlights } from '../../lib/rebuild/skills-instrument.ts';
import { activeCoachingPlan, type RebuildPilotPayload } from '../../lib/rebuild/plan-store.ts';
import { latestBiggerWorldReading } from '../../lib/reclaim/bigger-world-store.ts';
import { AUDIT_DOMAIN_LABEL } from '../../lib/reclaim/bigger-world-instrument.ts';
import { activeQualityDayProfile, recentQualityDays } from '../../lib/reclaim/quality-day-store.ts';
import { listFacets, closedSessionIds } from '../../lib/curriculum/store.ts';
import { getForecast } from '../../lib/curriculum/view.ts';
import { getAsset } from '../../lib/curriculum/registry.ts';
import { getDailyBeat } from '../../lib/daily-beat/store.ts';
import { getMemberExperience } from '../../lib/telemetry/store.ts';
import { itemStem, dimensionForIndex } from '../../lib/idq/instrument.ts';
import { getConnectSummaryForAgent } from '../../lib/connect/agent.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';

// Build the agent's context: dashboard facts + GRINTA! Index/trend + what they've recently read.
// The agent is AWARE of these (to reference naturally); it does not serve content into the chat.
async function buildContext(db: Db, memberId: string): Promise<CheckinContext | null> {
  const dash = await getDashboard(db, memberId);
  if (!dash) return null;
  // Degrade-not-crash (W-13): the companion is the cornerstone. `dash` is the ESSENTIAL read; everything below is
  // SUPPLEMENTARY context ("the agent knows X"). If ANY supplementary read rejects — e.g. a prod-drifted table, since
  // migrations don't auto-apply — fall back to this minimal-but-valid context instead of throwing. The rail then opens
  // with name + identity + doors + reclaim list (a real opening), NEVER the "something hiccupped" error greeting. Only
  // the 8 CheckinContext fields are required; the rest are optional, so the agent simply doesn't know the extras yet.
  const minimal: CheckinContext = {
    displayName: dash.displayName,
    identityNoun: dash.identityNoun,
    doorDisplayNames: dash.doors.map((d) => d.displayName),
    idScore: dash.score?.score ?? null,
    direction: dash.score?.direction ?? null,
    currentFocus: dash.currentFocus?.label ?? null,
    lastCompletedAsset: null,
    reclaimList: dash.reclaimList,
  };
  try {
  await maybeFoldMemory(db, memberId); // distill anything that has aged out of recall (best-effort, no-op until due)
  const [grinta, grintaReading, whyReading, skillsReading, pilotPlan, pilotTally, biggerWorld, qdProfile, qdRecent, consumedBites, profRows, idqRows, reclaimItems, beatRows, playbook, measures, linkedMeasureRows, facets, closedIds, lastClosedRows, forecast, experience] = await Promise.all([
    getGrinta(db, memberId, dash.identityNoun),
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

    recentConsumedTitles(db, memberId),
    db.query<{ intake_athletic_past: string | null; intake_gap: string | null; agent_memory: string | null; dashboard_snapshot: unknown }>(
      'select intake_athletic_past, intake_gap, agent_memory, dashboard_snapshot from member_profile where member_id=$1',
      [memberId],
    ),
    db.query<any>(
      `select sequence_no, id_score, physical_score, self_score, social_score, outlook_score, responses
       from idq_retake where member_id=$1 and cycle_indicator=1 order by sequence_no`,
      [memberId],
    ),
    getReclaimItems(db, memberId),
    db.query<{ n: number }>('select count(*)::int n from beat_completion where member_id=$1', [memberId]),
    playbookForAgent(db, memberId),
    measuresForAgent(db, memberId),
    db.query<{ reclaim_item_id: string }>(
      'select distinct reclaim_item_id from measure where member_id=$1 and reclaim_item_id is not null and archived_at is null',
      [memberId],
    ),
    listFacets(db, memberId),
    closedSessionIds(db, memberId),
    db.query<{ session_id: string }>(
      "select session_id from session_progress where member_id=$1 and status='closed' order by closed_at desc nulls last limit 1",
      [memberId],
    ),
    getForecast(db, memberId),
    getMemberExperience(db, memberId, (id) => getAsset(id)?.title ?? id),
  ]);
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
  const dailyBeat = (await getDailyBeat(db, memberId, activePhaseKey, new Date().toLocaleDateString('en-CA')))?.text ?? null;

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
  const recentChanges = diffSnapshot(asSnapshot(prof?.dashboard_snapshot), currSnapshot);
  await db
    .query('update member_profile set dashboard_snapshot=$1::jsonb, dashboard_snapshot_at=now() where member_id=$2', [
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
  const responses: unknown = latest?.responses;
  const idqAnswers = Array.isArray(responses)
    ? responses.map((score: number, i: number) => ({ dimension: dimensionForIndex(i), stem: itemStem(i), score }))
    : [];
  const connect = await getConnectSummaryForAgent(db, memberId);
  const movementLog = redesignEnabled() ? await movementLogSummary(db, memberId).catch(() => '') : '';
  return {
    today: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    displayName: dash.displayName,
    identityNoun: dash.identityNoun,
    namedSelves,
    completedSessions,
    nextStep,
    dailyBeat,
    doorDisplayNames: dash.doors.map((d) => d.displayName),
    idScore: dash.score?.score ?? null,
    direction: dash.score?.direction ?? null,
    currentFocus: dash.currentFocus?.label ?? null,
    lastCompletedAsset, // most-recently completed curriculum Session (Identity Excavation, …)
    reclaimList: dash.reclaimList,
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
    reclaimPriorities: biggerWorld
      ? { primary: AUDIT_DOMAIN_LABEL[biggerWorld.priorities.primary], momentumLever: AUDIT_DOMAIN_LABEL[biggerWorld.priorities.momentumLever] }
      : null, // Reclaim C2 — the member's chosen priority + momentum lever (plain language)
    qualityDay: qdProfile
      ? {
          nonNegotiables: qdProfile.nonNegotiables,
          days: qdRecent.length,
          recentAvg: qdRecent.length ? Math.round((qdRecent.reduce((s, r) => s + r.score, 0) / qdRecent.length) * 10) / 10 : null,
        }
      : null, // Reclaim C3 — the Quality-Day profile + recent logged average
    consumedBites,
    // The narrative from onboarding — so the agent can reference what the member actually shared,
    // not just the dashboard facts. This is what makes the first interaction feel "it knows me."
    pastSelf: prof?.intake_athletic_past ?? null,
    gapStory: prof?.intake_gap ?? null,
    identityParagraph: dash.identityParagraph ?? null,
    dimensions,
    idScoreHistory,
    idqAnswers,
    reclaimDetail: reclaimItems.map((r) => ({ text: r.text, category: r.category, state: r.state, tracked: linkedIds.has(r.id) })),
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
  };
  } catch (e) {
    // A supplementary read threw (prod drift / transient). Serve the minimal context so the cornerstone never 500s.
    console.warn('buildContext degraded to minimal — a supplementary read failed:', (e as Error).message);
    return minimal;
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
          return { ok: true, message: `Saved "${res.text}" to their Reclaim List (category: ${res.category}). It now shows on their dashboard and the Beat engine can work toward it — acknowledge it briefly and warmly.${trackNudge}` };
        }
        if (res.reason === 'vague') {
          return { ok: false, message: 'Not saved — that is a feeling/inner state, not something you could both watch happen in an ordinary week. Ask what it would look like on a Tuesday, sharpen it WITH them, then call add_reclaim_item again with the observable version.' };
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
      if (name === 'mark_reclaim_reclaimed') {
        // Hard confirm gate (code, not just prompt): a goal can't be flipped on a passing mention.
        if (input.confirmed !== true) {
          return { ok: false, message: 'Not marked yet — confirm with the member first ("Want me to mark that one reclaimed?"), then call again with confirmed=true.' };
        }
        const res = await markReclaimReclaimedByText(db, memberId, String(input.item ?? ''));
        if (res.ok) {
          mutated = true;
          return { ok: true, message: `Marked "${res.text}" reclaimed — it now shows a check on their Reclaim List and ticked their Journey. Acknowledge it warmly; this is a real milestone.` };
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
        if (res.reason === 'vague') {
          return { ok: false, message: 'Not changed — the new wording is a feeling, not something you could both watch happen. Sharpen it WITH them, then call refine_reclaim_item again.' };
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
        const body = String(input.body ?? '').trim();
        if (!isPlaybookSection(section) || section === 'journal' || !body) {
          return { ok: false, message: 'Not saved — a valid section (what_works | why_works | own_words) and body are required.' };
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
              : "Logged as a quiet day. No pressure — quiet counts too.";
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
      return { ok: false, message: 'Unknown tool.' };
    };
    const r = await checkinReply(ctx, history, memberMessage, executor);
    await appendMessages(db, memberId, [
      { role: 'member', text: memberMessage },
      { role: 'agent', text: r.reply },
    ]);
    return { ...r, mutated };
  } catch (e) {
    console.error('sendCheckin failed:', (e as Error).message);
    return {
      reply:
        "I'm having a moment on my end — try again shortly. If something feels urgent, please reach out to someone you trust, or call or text 988.",
    };
  }
}
