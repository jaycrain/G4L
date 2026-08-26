'use server';

import { getDb } from '../../lib/db/index.ts';
import { detectCrisis } from '../../lib/agent/governance.ts';
import { escalateCrisis } from '../../lib/agent/crisis-escalation.ts';
import { authorizeMember } from '../authz.ts';
import { logEvent } from '../../lib/telemetry/store.ts';
import { maybeTriggerDraft } from '../../lib/founder/triggers.ts';
import type { Db } from '../../lib/db/schema.ts';
import type { ConvMessage, ConvState, Expectation, Turn } from '../../lib/agent/onboarding.ts';
import { detectReconnectClaims } from '../../lib/agent/gate-claims.ts';
import { liveTurnReconnect, loadReconnectCaptures, reconnectEnabled, reconnectOpening, reconnectMeasurementClose, driftOpen, RECONNECT_ARC, BEAT_SEP } from '../../lib/agent/reconnect.ts';
import { expectsForState } from '../../lib/agent/onboarding-staged.ts';
import { saveArcSession, loadArcSession, clearArcSession } from '../../lib/agent/arc-session.ts';
import { softSetMemberDoors, getMemberDoorNames } from '../../lib/member/refine.ts';
import type { ReconnectCeremonyData } from '../../lib/ceremony/reconnect-ceremony-beats.ts';
import { earnedBadgeReveal } from '../../lib/ceremony/badge-reveal.ts';
import { emitHarvestMoment, drainHarvest, type KeeperType, type KeeperProposal } from '../../lib/agent/harvest.ts';
import { saveLegacyLetter } from '../../lib/reconnect/legacy-letter-store.ts';
import { keptScienceStages } from '../../lib/content/teaching-keep.ts';
import { claimDoorsFromBoard, setBiggestImpact, setQuietDriftClaim, type BoardSubmission } from '../../lib/reconnect/doors-board-claim.ts';
import { noteDoorProfile } from '../../lib/reconnect/door-profile.ts';
import { letterDateFor } from '../../lib/reconnect/legacy-letter.ts';
import { memberToday } from '../../lib/time/zone-store.ts';
import { DOORS } from '../../lib/doors.ts';
import { submitIdq } from '../../lib/gateway/flow.ts';
import { TOTAL_ITEMS } from '../../lib/idq/instrument.ts';
import { BASELINE_GRIT_ITEMS, CHECKPOINT_GRIT_ITEMS } from '../../lib/grinta/survey/instrument.ts';
import { scoreCheckpointGrit, grintaChangePct } from '../../lib/grinta/survey/scoring.ts';
import { persistGrintaReading, checkpointResponsesMap, getGrintaBaselineReading, latestGrintaReading } from '../../lib/grinta/survey/store.ts';
import { setGate, earnBadge, markSessionClosed, markCheckpointClosed } from '../../lib/curriculum/store.ts';

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
    // CAT-32 — INSTRUMENT-IDENTITY GUARD. IDQ (24 items) and the Checkpoint grit (6) share ONE
    // administeredResponses accumulator, and the between-instrument reset lives in a distant stage-confirm branch.
    // This used to take slice(0, 6) on faith: if that reset were ever missed — a refactor, a bypassed branch, a
    // resume with a leaked flag — the first SIX IDQ ANSWERS would be scored and written as the member's grit,
    // silently, into a frozen data contract they see on their dashboard. Wrong numbers about someone's own
    // resilience are worse than no numbers.
    //
    // An EXACT length is the cheap tell: on a clean crossing this is exactly 6; contaminated it is 30. Refuse and
    // shout rather than write a plausible-looking lie. Skipping the write is recoverable; a bad reading is not.
    const responses = turn.state.administeredResponses ?? [];
    if (responses.length !== CHECKPOINT_GRIT_ITEMS.length) {
      console.error(
        `CAT-32: refusing to write a Checkpoint grit reading — expected exactly ${CHECKPOINT_GRIT_ITEMS.length} ` +
          `responses, got ${responses.length}. The accumulator was not reset between instruments; ` +
          `member=${memberId}. NOT scoring, to avoid writing IDQ answers as grit.`,
      );
      return;
    }
    const grit = responses.slice(0, CHECKPOINT_GRIT_ITEMS.length);
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


// SESSION CLOSES — the half the v2.2 arc bypass forgot.
//
// Reconnect runs as ONE conversational arc, so it never touches the step-player's closeSessionAction or the
// checkpoint action. Badges were re-wired for that bypass (see persistReconnectComplete below); the SESSION CLOSE
// was not. Result on production: Greg opened seven Sessions across two days, finished Reconnect, crossed the
// checkpoint — and `session_progress` held ZERO rows for him, with not one session_close event. His work was real
// and simply unrecorded: no Session history, no time-on-asset (the open window never closed), and an operator
// panel that showed "—" and read as "did nothing". Found because Jay knew the program is linear and therefore
// that crossing the checkpoint with no closed Sessions was impossible (2026-07-31).
//
// Closed at each STAGE BOUNDARY rather than all at the end, so the open→close window per Session is the real
// elapsed time. Idempotent (markSessionClosed upserts and only emits session_close on the first close).
const RECONNECT_STAGE_ASSET: Record<string, string> = {
  doors: 'RCN-EXC',       // Identity Excavation — the Doors work
  measurement: 'RCN-IDQ', // The IDQ — the baseline ID Score
};

/**
 * R3 — persist the Legacy Letter once the member has confirmed it.
 *
 * THE DATE IS STAMPED HERE, NOT IN THE ENGINE. The letter is addressed one year from the member's OWN today, and
 * the engine is pure — computing it there would use server time and put a Boulder evening on tomorrow
 * (lib/time is the one authority for this). So the engine hands over the body and this stamps the date.
 *
 * LOUD ON FAILURE. This is the one artifact in the product written in the member's own first person, and they
 * have just been told it is saved. A swallowed write here means they go looking for it in their Playbook and it
 * is not there — the product having lied about the most personal thing it holds.
 */
/**
 * Persist the Doors board. The ENGINE stays pure — it records what she chose onto the turn; every write is here.
 *
 * ORDER MATTERS. Claims first, because setBiggestImpact refuses a Door she does not hold and the board is exactly
 * where a new one arrives. Then the temporal answers, then primary. A different order silently drops the Door she
 * just added — which would look like the board working and her answer vanishing.
 *
 * LOUD ON FAILURE. She has just tapped through eleven cards and been answered by name. A swallowed write here
 * means the Companion talks about Doors that are not in her record, and her Playbook never shows what she said.
 */
async function persistDoorsBoard(db: Db, memberId: string, turn: Turn): Promise<void> {
  const board = (turn.state as { boardSubmission?: BoardSubmission }).boardSubmission;
  if (!board) return;
  try {
    if (board.doors.length) {
      const written = await claimDoorsFromBoard(db, memberId, board.doors.map((d) => ({ slug: d.slug, relevance: d.relevance })));
      if (written.length !== board.doors.length) {
        console.error(`persistDoorsBoard: member=${memberId} claimed ${board.doors.length} Doors, wrote ${written.length}`);
      }
    }
    // The temporal answers go through the MODEL's update-only path deliberately: by now she holds every Door she
    // marked, so there is nothing left to create, and using the narrower contract keeps the "only a tap creates a
    // Door" rule true at every call site rather than only at the one that needed it.
    const temporal = [
      ...(board.first ? [{ slug: board.first, openedFirst: true }] : []),
      ...board.stillOpen.map((slug) => ({ slug, stillOpen: true })),
    ];
    if (temporal.length) await noteDoorProfile(db, memberId, temporal);
    if (board.biggest) await setBiggestImpact(db, memberId, board.biggest);
    await setQuietDriftClaim(db, memberId, board.quietDrift);
  } catch (err) {
    console.error(`persistDoorsBoard FAILED for member=${memberId} — her taps did not reach her record:`, err);
  }
}

/**
 * MEASURE WHAT THE MODEL CLAIMS IN RECONNECT. Reports only — nothing here can change a reply.
 *
 * Reconnect is the first arc a new member meets and has never had a claims gate: claimsGateOutcome was built
 * after Donna's 2026-08-20 onboarding walk and wired into onboarding alone. She then hit the same shape here
 * (item 12) — the model announced the Legacy Letter two beats before the engine opens it, saying "give me a
 * moment" for something that was not coming.
 *
 * WHY NOT JUST BLOCK IT. One duplicated sentence is untidy rather than harmful, and nobody knows yet whether it
 * is a stray or a pattern — we found it because she screenshotted it. Enforcing against families I guessed at is
 * how the voice gate produced "is that right the way it happened?" on 2026-08-23, a mangled question shipped to
 * a member mid-story. So this logs on real walks first, and we gate what actually fires.
 *
 * SYNCHRONOUS AND TOTALLY GUARDED. It runs on the member's turn, so a regex fault here must never cost her the
 * reply — the whole body is inside a catch that swallows. It is also the reason this is not awaited on anything.
 */
function logReconnectClaims(memberId: string, stage: string | undefined, reply: string): void {
  try {
    const hits = detectReconnectClaims(reply);
    if (!hits.length) return;
    // Grep target: RECONNECT_CLAIM. The member's prose is NEVER logged — families and stage only, because these
    // turns carry the hardest part of someone's story and a log line is not the place for it.
    console.warn(`[RECONNECT_CLAIM] member=${memberId} stage=${stage ?? 'unknown'} families=${hits.join(',')}`);
  } catch {
    // Detection is a diagnostic. It does not get to break a conversation.
  }
}

async function persistLegacyLetter(db: Db, memberId: string, turn: Turn): Promise<void> {
  const letter = turn.state.legacyLetter;
  const body = (letter?.body ?? '').trim();
  if (!body) return;
  try {
    const today = await memberToday(db, memberId);
    const res = await saveLegacyLetter(db, memberId, { body, datedFor: letterDateFor(today) });
    if (!res.ok) console.error(`persistLegacyLetter refused for member=${memberId}: ${res.reason}`);
  } catch (err) {
    console.error(`persistLegacyLetter FAILED for member=${memberId} — they were told it was saved:`, err);
  }
}

async function persistReconnectSessionCloses(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    const from = String(prev.stage ?? '');
    const to = String(turn.state.stage ?? '');
    if (from === to) return;
    // Left a stage that maps to a Session → that Session is done.
    const left = RECONNECT_STAGE_ASSET[from];
    if (left) await markSessionClosed(db, memberId, left);
    if (to === 'ceremony') {
      // The gateway is complete. The program is LINEAR — reaching the Ceremony means every Reconnect Session
      // was worked — so close any that are still open. This is the self-heal: a member who somehow skipped a
      // boundary (a resume across a deploy, a stage jump) still ends with a truthful record instead of a hole.
      for (const asset of [...Object.values(RECONNECT_STAGE_ASSET), 'RCN-CHK']) {
        await markSessionClosed(db, memberId, asset);
      }
    }
  } catch {
    // swallow — best-effort; never fail a member's turn over bookkeeping.
  }
}

// §2f completion: when the arc crosses INTO the Ceremony, Reconnect's work is done — set the phase gate so the
// dashboard advances (Journey shows Reconnect complete / Rewire lit, the forecast lights the next Rewire Session).
// Without this the dashboard stayed on Reconnect after the ceremony (Jay's walk). Idempotent; best-effort.
async function persistReconnectComplete(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<void> {
  try {
    if (turn.state.stage !== 'ceremony' || prev.stage === 'ceremony') return; // only on the crossing into the Ceremony
    // → activePhaseIndex 1 (Rewire is now "You're here"). Records the completion + crosses ONCE (markCheckpointClosed).
    await markCheckpointClosed(db, memberId, { assetId: 'RCN-CHK', eventRef: 'RCN-CHK', phase: 'reconnect' });
    // Finishing the REAL arc must earn the same milestone the old RCN-CHK checkpoint awarded (registry: RCN-CHK
    // earns 'reconnect-milestone'). The v2.2 arc bypasses the checkpoint action, so award it here on the crossing.
    await earnBadge(db, memberId, 'reconnect-milestone');
  } catch {
    // swallow — best-effort; the conversation turn already succeeded.
  }
}

// §2d harvest: drain any NEW harvest candidates the engine queued this turn (drift keeper now; legacy share later) via
// the existing member_event/emitHarvestMoment seam — same default-emit discipline as the §2b tell. Best-effort.
async function reconnectHarvestOffers(db: Db, memberId: string, prev: ConvState, turn: Turn): Promise<KeeperProposal[]> {
  // Nothing is committed here any more — these come back as OFFERS the member keeps inline. The QI moment still
  // emits (best-effort, guarded) so a declined offer is measurable.
  try {
    return await drainHarvest(db, memberId, prev, turn.state, 'reconnect');
  } catch (e) {
    console.error(`[reconnect] harvest drain failed for member=${memberId}:`, e);
    return [];
  }
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
        // The "from" for the move above. Same source as the pct — a move with no starting line is a number.
        reconnectBaseline: base?.strands.reconnect ?? null,
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
): Promise<{ ok: boolean; session?: { state: ConvState; messages: ConvMessage[]; expects?: Expectation; scienceSeen?: string[] }; error?: string }> {
  if (!reconnectEnabled()) return { ok: false, error: 'Reconnect is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const saved = await loadArcSession(db, memberId, 'reconnect');
    if (!saved || saved.messages.length === 0) return { ok: true }; // nothing to resume → the client starts fresh
    const expects = expectsForState(RECONNECT_ARC, saved.state);
    // WHAT SHE HAS ALREADY SEEN. Which cards are "taught" is derived from the stage, which says how far she got —
    // not what she was shown. On a resume the component has no memory of the earlier cards, so without this all
    // three re-render at the end of the thread, after the Legacy Letter (Donna, 2026-08-19).
    const scienceSeen = await keptScienceStages(db, memberId, 'reconnect');
    return { ok: true, session: { state: saved.state, messages: saved.messages, expects, scienceSeen } };
  } catch {
    return { ok: false, error: 'Could not load your session.' };
  }
}

export async function reconnectTurnAction(
  memberId: string,
  state: ConvState,
  history: ConvMessage[],
  message: string,
): Promise<{ ok: boolean; reply?: string; state?: ConvState; expects?: Expectation; error?: string; proposals?: KeeperProposal[] }> {
  if (!reconnectEnabled()) return { ok: false, error: 'Reconnect is not enabled.' };
  if (!(await authorizeMember(memberId))) return { ok: false, error: 'Not authorized.' };
  // GOVERNANCE — ESCALATE TO A HUMAN. The engine already short-circuits this turn to the 988 protocol
  // (runArcTurn); that is the member's immediate help and it is unchanged. This is the other half of the rule
  // the Framework states and our own prohibitions spell out ("Route to 988 and escalate to a human within
  // 24h") — until 2026-08-07 nothing recorded a crisis anywhere, so no human could have followed up on one.
  // Checked here with the SAME predicate the engine uses, so the two can never disagree about what counts.
  if (detectCrisis(message).flagged) {
    await escalateCrisis((await getDb()) as unknown as Db, memberId, { surface: 'session', message });
  }
  try {
    // Every turn (INCLUDING entry) is a live model turn — the entry stage RECEIVES the member's answer to the callback
    // in the model's voice (listen-first), then the engine hands into the Doors excavation as a second beat. (Was
    // deterministic with empty model text, which is why the acknowledgment never appeared and it jumped to the Door.)
    const turn = await liveTurnReconnect(state, history, message);
    logReconnectClaims(memberId, state.stage, turn.reply);
    // Committed side-effects this turn persist to the DB (best-effort): a re-seeing (§2b) + a completed IDQ (§2c).
    const db = (await getDb()) as unknown as Db;
    await persistRevision(db, memberId, state, turn);
    const proposals = await reconnectHarvestOffers(db, memberId, state, turn); // §2d — offered, not committed
    await persistCheckpoint(db, memberId, state, turn); // §2e Checkpoint — the first grinta movement
    await persistDoorsBoard(db, memberId, turn); // R2 — her Doors board taps, before anything reads the set
    await persistLegacyLetter(db, memberId, turn); // R3 — the member's own letter, dated in THEIR timezone
    await persistReconnectSessionCloses(db, memberId, state, turn); // record the Session closes the arc bypass dropped
    await persistReconnectComplete(db, memberId, state, turn); // §2f — advance the dashboard phase (Reconnect → Rewire)
    // On IDQ completion this may return a personalized close (M3) that ties the baseline shape to their doors —
    // UPGRADING the engine's generic close; null → the generic close stands.
    const closeOverride = await persistMeasurement(db, memberId, state, turn);
    const finalReply = closeOverride ?? turn.reply;
    await persistArcSession(db, memberId, history, message, finalReply, turn); // W-15 — save the transcript for resume (or clear at ceremony)
    return { ok: true, reply: finalReply, state: turn.state, expects: turn.expects, proposals };
  } catch {
    return { ok: false, error: 'Something went wrong — please try again.' };
  }
}
