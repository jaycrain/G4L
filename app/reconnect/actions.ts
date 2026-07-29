'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { logEvent } from '../../lib/telemetry/store.ts';
import { maybeTriggerDraft } from '../../lib/founder/triggers.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState, Expectation, Turn } from '../../lib/agent/onboarding.ts';
import { liveTurnReconnect, loadReconnectCaptures, reconnectEnabled, reconnectOpening, reconnectMeasurementClose, driftOpen, RECONNECT_ARC, BEAT_SEP } from '../../lib/agent/reconnect.ts';
import { scaleExpects } from '../../lib/agent/onboarding-staged.ts';
import { saveArcSession, loadArcSession, clearArcSession } from '../../lib/agent/arc-session.ts';
import { softSetMemberDoors, getMemberDoorNames } from '../../lib/member/refine.ts';
import type { ReconnectCeremonyData } from '../../lib/ceremony/reconnect-ceremony-beats.ts';
import { earnedBadgeReveal } from '../../lib/ceremony/badge-reveal.ts';
import { emitHarvestMoment, drainHarvest, type KeeperType } from '../../lib/agent/harvest.ts';
import { DOORS } from '../../lib/doors.ts';
import { submitIdq } from '../../lib/gateway/flow.ts';
import { TOTAL_ITEMS } from '../../lib/idq/instrument.ts';
import { BASELINE_GRIT_ITEMS, CHECKPOINT_GRIT_ITEMS } from '../../lib/grinta/survey/instrument.ts';
import { scoreCheckpointGrit, grintaChangePct } from '../../lib/grinta/survey/scoring.ts';
import { persistGrintaReading, checkpointResponsesMap, getGrintaBaselineReading, latestGrintaReading } from '../../lib/grinta/survey/store.ts';
import { setGate, earnBadge } from '../../lib/curriculum/store.ts';

// v2.2 Reconnect server actions. Flag-gated. The callback (entry) READS committed captures and opens; the DOORS
// excavation (§2b) is a live model turn (draw-out + insight + the re-seeing revision). Conversation state is
// client-held; a COMMITTED revision, though, persists to the DB (below).

// §2b revision persistence: when a turn COMMITTED a door re-seeing, sync it to the 0043 substrate — the door set via
// soft-delete (softSetMemberDoors, never destroys the old), and the re-seeing TELL via the existing member_event /
// emitHarvestMoment seam (R5: from→to in meta). Best-effort — a persistence failure must never break the turn (the
// client state still carries the swap; the record catches up next turn).
async function persistRevision(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    const before = prev.collected.doors ?? [];
    const after = turn.state.collected.doors ?? [];
    if (after.length && JSON.stringify(before) !== JSON.stringify(after)) {
      await softSetMemberDoors(db, memberId, after); // covers a flat mislabel too (door changed, no tell)
    }
    const priorTells = prev.reseeingTells?.length ?? 0;
    for (const t of (turn.state.reseeingTells ?? []).slice(priorTells)) {
      const name = (s: string) => DOORS.find((d) => d.slug === s)?.displayName ?? s;
      // A correct carries from→to (a re-seeing pair); a widen/name carries just the surfaced Door.
      const desc = t.fromSlug ? `${name(t.fromSlug)} → ${name(t.toSlug)}` : `+ ${name(t.toSlug)}`;
      await emitHarvestMoment(db, memberId, {
        destinationIntent: 'keeper',
        keeperType: 'tell',
        surface: 'reconnect',
        sourceRef: { kind: 'reconnect', ref: 'doors', label: `Re-seeing · ${desc}` },
        payloadRef: desc,
        pair: t.fromSlug ? { fromSlug: t.fromSlug, toSlug: t.toSlug } : { toSlug: t.toSlug },
      });
    }
  } catch {
    // swallow — persistence is best-effort; the turn already succeeded for the member.
  }
}

// §2c measurement persistence: when the administered IDQ beat COMPLETES this turn (the 24th response lands), score +
// write the baseline via the frozen submitIdq (sequence_no=0). Fires exactly once — on the turn the count crosses
// TOTAL_ITEMS. Best-effort (a write failure never breaks the turn; the responses stay in state to retry).
// Returns a personalized CLOSE (M3) to OVERRIDE the engine's generic close when measurement completes this turn, or
// null (not a completion turn, or the model close failed → the generic close stands).
async function persistMeasurement(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<string | null> {
  try {
    const before = prev.administeredResponses?.length ?? 0;
    const after = turn.state.administeredResponses ?? [];
    if (before < TOTAL_ITEMS && after.length >= TOTAL_ITEMS) {
      const responses = after.slice(0, TOTAL_ITEMS);
      const idq = await submitIdq(db, memberId, responses); // frozen instrument: validate + score + baseline row (sequence_no=0)
      // Founder Agent auto-trigger — the baseline welcome note into Jay's review queue. The v3.0 baseline is written
      // HERE (not the legacy /idq action), so without this the redesign never queued a draft. Draft-only, graceful.
      if (idq.ok) await maybeTriggerDraft(db, memberId, { kind: 'idq', sequenceNo: idq.sequenceNo });
      const close = await reconnectMeasurementClose(turn.state.collected, responses); // ties the shape to their doors
      // Hand into §2d as its OWN bubble (BEAT_SEP) — the score read and the take-stock ask are separate beats.
      return close ? `${close}${BEAT_SEP}${driftOpen(turn.state.collected)}` : null;
    }
  } catch {
    // swallow — best-effort; the conversation turn already succeeded.
  }
  return null;
}

// §2e Checkpoint persistence: when the administered grit beat COMPLETES this turn (the 6th grit response lands and the
// arc hands checkpoint → ceremony), recompute grit from NINE items (the 3 onboarding baseline + these 6), carry the
// other strands forward, and write the Checkpoint reading (grinta_reading, source 'checkpoint'). This is the FIRST time
// grinta moves. Fires exactly once — on the crossing. Best-effort (a write failure never breaks the turn/ceremony).
async function persistCheckpoint(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    if (prev.stage !== 'checkpoint' || turn.state.stage !== 'ceremony') return; // only on the completion crossing
    const grit = (turn.state.administeredResponses ?? []).slice(0, CHECKPOINT_GRIT_ITEMS.length);
    if (grit.length < CHECKPOINT_GRIT_ITEMS.length) return;
    const base = await getGrintaBaselineReading(db, memberId);
    const baselineGritValues = base
      ? BASELINE_GRIT_ITEMS.map((c) => base.responses[c]).filter((v): v is number => v != null)
      : [];
    const cp = scoreCheckpointGrit({
      baselineGritValues,
      newGritValues: grit,
      carriedStrands: { rewire: base?.strands.rewire, rebuild: base?.strands.rebuild, reclaim: base?.strands.reclaim },
    });
    await persistGrintaReading(db, memberId, { source: 'checkpoint', responses: checkpointResponsesMap(grit), score: cp.score });
  } catch {
    // swallow — best-effort; the conversation turn already succeeded.
  }
}

// §2f completion: when the arc crosses INTO the Ceremony, Reconnect's work is done — set the phase gate so the
// dashboard advances (Journey shows Reconnect complete / Rewire lit, the forecast lights the next Rewire Session).
// Without this the dashboard stayed on Reconnect after the ceremony (Jay's walk). Idempotent; best-effort.
async function persistReconnectComplete(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    if (turn.state.stage !== 'ceremony' || prev.stage === 'ceremony') return; // only on the crossing into the Ceremony
    await setGate(db, memberId, 'reconnect_checkpoint_passed'); // → activePhaseIndex 1 (Rewire is now "You're here")
    await logEvent(db, memberId, 'checkpoint_cross', { surface: 'checkpoint', ref: 'RCN-CHK', meta: { phase: 'reconnect' } });
    // Finishing the REAL arc must earn the same milestone the old RCN-CHK checkpoint awarded (registry: RCN-CHK
    // earns 'reconnect-milestone'). The v2.2 arc bypasses the checkpoint action, so award it here on the crossing.
    await earnBadge(db, memberId, 'reconnect-milestone');
  } catch {
    // swallow — best-effort; the conversation turn already succeeded.
  }
}

// §2d harvest: drain any NEW harvest candidates the engine queued this turn (drift keeper now; legacy share later) via
// the existing member_event/emitHarvestMoment seam — same default-emit discipline as the §2b tell. Best-effort.
async function persistHarvest(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  // drainHarvest emits the QI moment + commits the keeper as INDEPENDENT best-effort steps (a moment-emit failure
  // never costs the keeper — the prod silent-drop that lost Millie's session keepers), each guarded + logged.
  await drainHarvest(db, memberId, prev, turn.state, 'reconnect');
}

export async function startReconnectAction(memberId: string): Promise<{ ok: boolean; reply?: string; state?: ConvState; expects?: Expectation; error?: string }> {
  if (!reconnectEnabled()) return { ok: false, error: 'Reconnect is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  const db = (await getDb()) as unknown as Db;
  const committed = await loadReconnectCaptures(db, memberId);
  if (!committed) return { ok: false, error: 'We could not find your intake.' };
  const turn = reconnectOpening(committed);
  return { ok: true, reply: turn.reply, state: turn.state, expects: turn.expects };
}

// §2f — assemble the Ceremony reveal data from the DB when the arc reaches stage 'ceremony': the baseline ID Score +
// dimensions (§2c), the §2d Playbook keepers (drift + spark, in the member's words), and the Door(s) as they stand.
export async function reconnectCeremonyDataAction(memberId: string): Promise<{ ok: boolean; data?: ReconnectCeremonyData; error?: string }> {
  if (!reconnectEnabled()) return { ok: false, error: 'Reconnect is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const s = (
      await db.query<{ id_score: string; physical_score: string; self_score: string; social_score: string; outlook_score: string }>(
        'select id_score, physical_score, self_score, social_score, outlook_score from idq_retake where member_id=$1 and cycle_indicator=1 order by sequence_no desc limit 1',
        [memberId],
      )
    ).rows[0];
    const keepers = (
      await db.query<{ body: string }>(
        "select body from playbook_entry where member_id=$1 and source_ref in ('drift','window') and state='kept' order by sort_order",
        [memberId],
      )
    ).rows.map((r) => r.body);
    const doors = await getMemberDoorNames(db, memberId);
    // §2e — the Grinta movement, revealed only when the Checkpoint captured it (latest reading is a checkpoint). The
    // reveal shows the Index (headline) + Reconnect (the driver): Reconnect's OWN delta vs the baseline grit, so the
    // smaller composite % reads as "you moved the Index by moving Reconnect."
    const g = await latestGrintaReading(db, memberId);
    let grinta: ReconnectCeremonyData['grinta'] = null;
    if (g && g.source === 'checkpoint' && g.strands.reconnect != null) {
      const base = await getGrintaBaselineReading(db, memberId);
      grinta = {
        composite: g.composite,
        changePct: g.changePct,
        direction: g.direction,
        reconnect: g.strands.reconnect,
        reconnectChangePct: grintaChangePct(g.strands.reconnect, base?.strands.reconnect ?? null),
      };
    }
    return {
      ok: true,
      data: {
        idScore: s ? Number(s.id_score) : null,
        dimensions: s ? { physical: Number(s.physical_score), self: Number(s.self_score), social: Number(s.social_score), outlook: Number(s.outlook_score) } : null,
        grinta,
        keepers,
        doors,
        badge: earnedBadgeReveal('reconnect'),
      },
    };
  } catch {
    return { ok: false, error: 'Could not load the ceremony.' };
  }
}

// W-15 — per-turn save/resume. Reconnect (esp. the Doors excavation) was client-held only, so a refresh/crash lost the
// in-progress work. After each turn we persist the working state + the full transcript keyed by (member, 'reconnect'),
// and CLEAR it once the arc reaches the ceremony (done). Best-effort: a save hiccup never breaks the member's turn.
const beatBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));

async function persistArcSession(db: Db, memberId: string, history: ConvMessage[], message: string, reply: string, turn: Turn): Promise<void> {
  try {
    if (turn.state.stage === 'ceremony') {
      await clearArcSession(db, memberId, 'reconnect'); // completed — the committed artifacts persist on their own
      return;
    }
    // Reconstruct the transcript exactly as the client renders it: prior bubbles + this member turn + the reply's beats.
    const messages: ConvMessage[] = [...history, { role: 'member', text: message }, ...beatBubbles(reply)];
    await saveArcSession(db, memberId, 'reconnect', turn.state, messages);
  } catch {
    // swallow — resume is best-effort; the turn already succeeded for the member.
  }
}

// W-15 — resume the in-flight Reconnect on mount. Returns the saved transcript + state (and recomputes the chip signal
// from the resumed stage, so a refresh mid-IDQ restores the scale chips), or null when there's nothing to resume.
export async function loadReconnectSessionAction(
  memberId: string,
): Promise<{ ok: boolean; session?: { state: ConvState; messages: ConvMessage[]; expects?: Expectation }; error?: string }> {
  if (!reconnectEnabled()) return { ok: false, error: 'Reconnect is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const saved = await loadArcSession(db, memberId, 'reconnect');
    if (!saved || saved.messages.length === 0) return { ok: true }; // nothing to resume → the client starts fresh
    const expects = scaleExpects(RECONNECT_ARC, saved.state.stage as never, false);
    return { ok: true, session: { state: saved.state, messages: saved.messages, expects } };
  } catch {
    return { ok: false, error: 'Could not load your session.' };
  }
}

export async function reconnectTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
): Promise<{ ok: boolean; reply?: string; state?: ConvState; expects?: Expectation; error?: string }> {
  if (!reconnectEnabled()) return { ok: false, error: 'Reconnect is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    // Every turn (INCLUDING entry) is a live model turn — the entry stage RECEIVES the member's answer to the callback
    // in the model's voice (listen-first), then the engine hands into the Doors excavation as a second beat. (Was
    // deterministic with empty model text, which is why the acknowledgment never appeared and it jumped to the Door.)
    const turn = await liveTurnReconnect(state, history, message);
    // Committed side-effects this turn persist to the DB (best-effort): a re-seeing (§2b) + a completed IDQ (§2c).
    const db = (await getDb()) as unknown as Db;
    await persistRevision(db, memberId, state, turn);
    await persistHarvest(db, memberId, state, turn); // §2d drift keeper (and later legacy share)
    await persistCheckpoint(db, memberId, state, turn); // §2e Checkpoint — the first grinta movement
    await persistReconnectComplete(db, memberId, state, turn); // §2f — advance the dashboard phase (Reconnect → Rewire)
    // On IDQ completion this may return a personalized close (M3) that ties the baseline shape to their doors —
    // UPGRADING the engine's generic close; null → the generic close stands.
    const closeOverride = await persistMeasurement(db, memberId, state, turn);
    const finalReply = closeOverride ?? turn.reply;
    await persistArcSession(db, memberId, history, message, finalReply, turn); // W-15 — save the transcript for resume (or clear at ceremony)
    return { ok: true, reply: finalReply, state: turn.state, expects: turn.expects };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
