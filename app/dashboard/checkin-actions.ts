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
import { markReclaimReclaimedByText, unmarkReclaimReclaimedByText, refineReclaimItemByText } from '../../lib/beats/store.ts';
import { proposeEntry, playbookForAgent, isPlaybookSection } from '../../lib/playbook/store.ts';
import { createMeasure, logReadingByLabel, measuresForAgent, findReclaimItemId, looksTrackable } from '../../lib/measure/store.ts';
import { maybeFoldMemory } from '../../lib/agent/memory.ts';
import { getGrinta } from '../../lib/grinta/index.ts';
import { itemStem, dimensionForIndex } from '../../lib/idq/instrument.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';

// Build the agent's context: dashboard facts + GRINTA! Index/trend + what they've recently read.
// The agent is AWARE of these (to reference naturally); it does not serve content into the chat.
async function buildContext(db: Db, memberId: string): Promise<CheckinContext | null> {
  const dash = await getDashboard(db, memberId);
  if (!dash) return null;
  await maybeFoldMemory(db, memberId); // distill anything that has aged out of recall (best-effort, no-op until due)
  const [grinta, consumedBites, profRows, idqRows, reclaimItems, beatRows, playbook, measures, linkedMeasureRows] = await Promise.all([
    getGrinta(db, memberId, dash.identityNoun),
    recentConsumedTitles(db, memberId),
    db.query<{ intake_athletic_past: string | null; intake_gap: string | null; agent_memory: string | null }>(
      'select intake_athletic_past, intake_gap, agent_memory from member_profile where member_id=$1',
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
  ]);
  const prof = profRows.rows[0];
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
  return {
    today: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    displayName: dash.displayName,
    identityNoun: dash.identityNoun,
    doorDisplayNames: dash.doors.map((d) => d.displayName),
    idScore: dash.score?.score ?? null,
    direction: dash.score?.direction ?? null,
    currentFocus: dash.currentFocus?.label ?? null,
    lastCompletedAsset: null, // (wire to most-recent asset_completion later)
    reclaimList: dash.reclaimList,
    grintaScore: grinta.score,
    grintaTrend: grinta.direction,
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
    beatsDone: beatRows.rows[0]?.n ?? 0,
    playbookKeepers: playbook.keepers,
    playbookNotes: playbook.recentNotes,
    measures,
    trackableUntracked,
    agentMemory: prof?.agent_memory ?? null,
  };
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
        return { ok: false, message: "Couldn't map that to one of the Fade Doors. Reflect what they said and ask a little more about what happened, then try again." };
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
