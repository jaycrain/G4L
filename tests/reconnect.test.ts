import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconnectCallback, reconnectOpening, applyReconnectTurn, reconnectEnabled } from '../lib/agent/reconnect.ts';
import type { Collected, ConvMessage, ConvState } from '../lib/agent/onboarding.ts';
import { TOTAL_ITEMS } from '../lib/idq/instrument.ts';

// ============================================================================================================
// v2.2 Reconnect — SKELETON + callback (§2a). The callback READS the committed captures (never the transcript)
// and opens the deeper work as a REVISABLE check. Read-only this increment: it writes nothing, revises nothing.
// ============================================================================================================

test('reconnect · flag defaults OFF (never runs in prod until the coupled flip)', () => {
  const prev = process.env.RECONNECT;
  delete process.env.RECONNECT;
  assert.equal(reconnectEnabled(), false);
  if (prev !== undefined) process.env.RECONNECT = prev;
});

// --- the callback opener across capture richness ---------------------------------------------------------
test('reconnect callback · a named Door → the revisable check lands on it by name', () => {
  const committed: Collected = { identityNoun: 'Player', doors: ['grind'], gap: 'The grind slowly crowded him out over years.', reclaimList: ['ride my bike', 'see friends'] };
  const reply = reconnectCallback(committed);
  assert.match(reply, /the Player/, 'names who they are reclaiming');
  assert.match(reply, /The Grind/, 'names the primary Door by its branded name');
  assert.match(reply, /still where it feels like it began|has something shifted/i, 'frames it as REVISABLE, not a fixed recap');
  assert.match(reply, /deeper/i, 'signals the deeper work');
});

test('reconnect callback · MULTIPLE recognized Doors → primary named, the second acknowledged (never dropped)', () => {
  const committed: Collected = { identityNoun: 'Player', doors: ['grind', 'marriage'], gap: 'x' };
  const reply = reconnectCallback(committed);
  assert.match(reply, /The Grind/, 'the primary Door is named');
  assert.match(reply, /The Marriage/, 'the second recognized Door is acknowledged, not silently dropped');
  assert.match(reply, /tangled up/i, 'lightly links them rather than listing');
  // three+ doors: primary named, the rest acknowledged as a group
  const many = reconnectCallback({ identityNoun: 'Player', doors: ['grind', 'marriage', 'body'], gap: 'x' });
  assert.match(many, /The Grind/, 'primary named even with several');
  assert.match(many, /couple of others|stacked/i, 'the rest are acknowledged, not enumerated');
});

test('reconnect callback · GRACEFUL DEGRADE — no Door tagged → opens on the gap story, still revisable', () => {
  const committed: Collected = { identityNoun: 'Runner', doors: [], gap: 'It opened slowly when caregiving took all my time.' };
  const reply = reconnectCallback(committed);
  assert.doesNotMatch(reply, /\bThe [A-Z]/, 'no Door name fabricated when none was committed');
  assert.match(reply, /the Runner/, 'still anchors on the identity');
  assert.match(reply, /deeper|still feel/i, 'opens on the story and invites revision');
});

test('reconnect callback · GRACEFUL DEGRADE — identity was skipped → no identity reference', () => {
  const committed: Collected = { identitySkipped: true, doors: ['marriage'], gap: 'The marriage drifted into coexisting.' };
  const reply = reconnectCallback(committed);
  assert.doesNotMatch(reply, /reclaiming —/, 'does not reference an identity the member never named');
  assert.match(reply, /The Marriage/, 'still lands on the committed Door');
});

test('reconnect callback · GRACEFUL DEGRADE — thin/null captures → a warm open that does NOT fake continuity', () => {
  const committed: Collected = { identitySkipped: true, doors: [], gap: '' };
  const reply = reconnectCallback(committed);
  assert.doesNotMatch(reply, /The [A-Z]\w+/, 'no Door invented');
  assert.doesNotMatch(reply, /you (started to )?tell me how/i, 'does not claim a gap story that was never captured');
  assert.match(reply, /pick up|deeper/i, 'still a warm hand-off into the deeper work');
});

// --- the opening turn + the read-only entry stage --------------------------------------------------------
test('reconnect · opening turn carries the callback + the committed captures pre-loaded, at stage "entry"', () => {
  const committed: Collected = { identityNoun: 'Player', doors: ['grind'], gap: 'The grind took over.' };
  const turn = reconnectOpening(committed);
  assert.equal(turn.state.stage, 'entry');
  assert.deepEqual(turn.state.collected, committed, 'the committed captures are pre-loaded (read from member_profile in the live path)');
  assert.equal(turn.complete, false);
});

test('reconnect · the callback is READ-ONLY — a first response hands into Doors and revises NOTHING (yet)', () => {
  const committed: Collected = { identityNoun: 'Player', doors: ['grind'], gap: 'The grind took over.' };
  const atEntry: ConvState = { stage: 'entry', collected: committed };
  // Even an explicit correction at the callback does not mutate captures at the entry beat — revision lives inside
  // the excavation (a later §2b increment), member-confirmed + versioned. The entry just hands in.
  const turn = applyReconnectTurn(atEntry, [], "actually it was really my divorce, not the grind", { text: 'That’s a real thread.' });
  assert.equal(turn.state.stage, 'doors', 'hands into the Doors excavation');
  assert.deepEqual(turn.state.collected.doors, ['grind'], 'no revision committed at entry — captures untouched');
  // Listen-first: the model's acknowledgment of what they just said LEADS, then the Door excavation opens as its own
  // beat (the action now feeds a live model turn here, so this is no longer empty → it never jumps straight to the Door).
  assert.match(turn.reply, /That’s a real thread\./, 'the model ack leads');
  assert.match(turn.reply, /The Grind/, 'then opens the real excavation on the primary door');
});

// ============================================================================================================
// §2b Doors Excavation (increment 1) — the ENGINE structure. The insight QUALITY is a felt walk; these pin the
// model-judged depth floor/cap, the confirm routing, and graceful degradation (a StageDef on the kernel).
// ============================================================================================================

test('reconnect doors · entry hands into the excavation, opening on the committed PRIMARY door', () => {
  const atEntry: ConvState = { stage: 'entry', collected: { identityNoun: 'Racer', doors: ['marriage', 'grind'], gap: 'The divorce took it.' } };
  const turn = applyReconnectTurn(atEntry, [], 'yeah, still the marriage', { text: '' });
  assert.equal(turn.state.stage, 'doors', 'advances into the Doors excavation');
  assert.match(turn.reply, /The Marriage/, 'opens on the committed primary door, by name');
  assert.match(turn.reply, /the real thing|actually happened|most vivid/i, 'invites the real story, not a summary');
});

test('reconnect doors · DEPTH FLOOR holds — reflect_door on the first exchange does NOT reflect (no insight w/o material)', () => {
  const atDoors: ConvState = { stage: 'doors', collected: { identityNoun: 'Racer', doors: ['marriage'] } };
  // Model tries to close on turn 1 (depthReady) — the floor must keep it drawing out.
  const turn = applyReconnectTurn(atDoors, [], 'it started when she checked out', { text: 'When did you first feel that? What did it take?', depthReady: true });
  assert.equal(turn.state.awaitingConfirm ?? false, false, 'the FLOOR overrides an early reflect_door — keeps drawing out');
});

test('reconnect doors · MODEL-JUDGED advance — reflect_door past the floor reflects the insight', () => {
  const atDoors: ConvState = { stage: 'doors', stageScratch: { doors: { doorDepth: 2 } }, collected: { identityNoun: 'Racer', doors: ['marriage'] } };
  const insight = "So the racing didn't just fade — you handed it over piece by piece and stopped counting the cost. Does that land, or is it not quite the shape?";
  const turn = applyReconnectTurn(atDoors, [], 'yeah, and I stopped racing entirely', { text: insight, depthReady: true });
  assert.equal(turn.state.awaitingConfirm, true, 'past the floor + model-judged → reflects and awaits the check');
  assert.match(turn.reply, /stopped counting the cost/, 'the model insight (in their words) is what is reflected');
});

test('reconnect doors · CAP forces a reflect even without the signal (anti-loop)', () => {
  const atDoors: ConvState = { stage: 'doors', stageScratch: { doors: { doorDepth: 4 } }, collected: { identityNoun: 'Racer', doors: ['marriage'] } };
  const turn = applyReconnectTurn(atDoors, [], 'and there was more too', { text: "Here's what I keep hearing across all of it." });
  assert.equal(turn.state.awaitingConfirm, true, 'the CAP reflects even with no reflect_door signal');
});

test('reconnect doors · GRACEFUL DEGRADATION — no material to synthesize → a smaller honest reflection, never a manufactured pattern', () => {
  const atDoors: ConvState = { stage: 'doors', stageScratch: { doors: { doorDepth: 4 } }, collected: { identityNoun: 'Racer', doors: ['marriage'] } };
  const turn = applyReconnectTurn(atDoors, [], 'idk', { text: '' }); // cap hit, but the model returned nothing
  assert.equal(turn.state.awaitingConfirm, true);
  assert.match(turn.reply, /still finding it|before it's earned/i, 'degrades honestly — does not fabricate an insight');
});

test('reconnect doors · confirm — "that\'s it" advances; a DISPUTE takes the correction humbly', () => {
  const base: ConvState = { stage: 'doors', awaitingConfirm: true, collected: { identityNoun: 'Racer', doors: ['marriage'] } };
  const done = applyReconnectTurn(base, [], "yeah, that's exactly it", { text: 'Good.', replyIntent: 'done' });
  assert.equal(done.state.stage, 'measurement', 'a landed insight hands into the measurement block (§2c stub)');
  const dispute = applyReconnectTurn(base, [], "no, that's not it at all", { text: '', replyIntent: 'dispute' });
  assert.equal(dispute.state.awaitingConfirm, false, 'a dispute reopens');
  assert.equal(dispute.state.stage, 'doors', 'stays in the Doors beat');
  assert.match(dispute.reply, /get this right|help me see it|what did I miss/i, 'takes the correction humbly, no defense');
});

// ============================================================================================================
// §2b Revision (Decision L, slice 1) — the primary CORRECT (re-seeing). Propose ≠ commit (R1); a confirmed correct
// swaps the primary Door in place (R3) and re-opens the insight (R2); the tell fires by the ENFORCEABLE DEFAULT —
// emit UNLESS the model flagged an explicit flat mislabel (R4 + default-emit). No DB this slice (in-memory).
// ============================================================================================================

test('reconnect revision · PROPOSE ≠ COMMIT — a proposed re-seeing is offered, changes nothing until confirmed (R1)', () => {
  const atDoors: ConvState = { stage: 'doors', stageScratch: { doors: { doorDepth: 2 } }, collected: { identityNoun: 'Racer', doors: ['marriage'] } };
  const turn = applyReconnectTurn(atDoors, [], 'it was all about carrying everyone', {
    text: 'You came in on The Marriage — but everything you just said is about carrying the load. Truer as The Load-Bearer?',
    revision: { fromSlug: 'marriage', toSlug: 'load_bearer', kind: 'correct' },
  });
  assert.equal(turn.state.awaitingConfirm, true, 'offered as a check — awaits the member');
  assert.deepEqual(turn.state.pendingRevision, { fromSlug: 'marriage', toSlug: 'load_bearer', kind: 'correct' }, 'the proposal is held for the confirm turn');
  assert.deepEqual(turn.state.collected.doors, ['marriage'], 'NOTHING changes until they confirm (offered, not asserted)');
  assert.equal((turn.state.reseeingTells ?? []).length, 0, 'no tell before commit');
});

test('reconnect revision · CONFIRM commits the swap in place + emits the tell by default (R2/R3/R4)', () => {
  const pending: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { fromSlug: 'marriage', toSlug: 'load_bearer', kind: 'correct' }, collected: { identityNoun: 'Racer', doors: ['grind', 'marriage'] } };
  const turn = applyReconnectTurn(pending, [], "yeah — that's the one. The Load-Bearer.", { text: '', replyIntent: 'done' });
  assert.deepEqual(turn.state.collected.doors, ['grind', 'load_bearer'], 'swaps in place — primary (grind) untouched, marriage→load_bearer');
  assert.deepEqual(turn.state.reseeingTells, [{ fromSlug: 'marriage', toSlug: 'load_bearer' }], 'a real re-seeing emits a tell (default-emit)');
  assert.equal(turn.state.pendingRevision, undefined, 'pending cleared');
  assert.equal(turn.state.stage, 'doors', 'R2: re-opens on the corrected door, does NOT hand off with a stale insight');
  assert.match(turn.reply, /Load-Bearer/, 'names the corrected door back');
});

test('reconnect revision · an AFFIRMATION WITH added color still commits (default-to-commit-unless-disputed)', () => {
  // The live-walk bug: "yeah, that's truer — it was really the carrying…" reads as 'addition', not 'done'. A re-seeing
  // is a yes/no offer, so anything that isn't a DISPUTE commits (and keeps drawing out) — never a re-proposal loop.
  const pending: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { fromSlug: 'marriage', toSlug: 'load_bearer', kind: 'correct' }, collected: { doors: ['marriage'] } };
  const turn = applyReconnectTurn(pending, [], "yeah, that's truer — it was really the carrying, all of it landing on me", { text: 'go on', replyIntent: 'more' });
  assert.deepEqual(turn.state.collected.doors, ['load_bearer'], 'accepted-with-color still commits the swap');
  assert.deepEqual(turn.state.reseeingTells, [{ fromSlug: 'marriage', toSlug: 'load_bearer' }], 'and emits the tell');
  assert.equal(turn.state.pendingRevision, undefined, 'no re-proposal loop — the offer resolved');
  assert.match(turn.reply, /\?\s*$/, 'keeps drawing out on the corrected door');
});

test('reconnect revision · a FLAT MISLABEL swaps but emits NO tell (suppress-on-explicit — the only no-harvest case)', () => {
  const pending: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { fromSlug: 'marriage', toSlug: 'load_bearer', kind: 'correct', flatMislabel: true }, collected: { doors: ['marriage'] } };
  const turn = applyReconnectTurn(pending, [], 'yeah I just said the wrong name', { text: '', replyIntent: 'done' });
  assert.deepEqual(turn.state.collected.doors, ['load_bearer'], 'the correction still applies');
  assert.equal(turn.state.reseeingTells, undefined, 'an explicit flat mislabel is NOT a keeper — no tell');
});

test('reconnect revision · a REJECTED re-seeing keeps their door, humbly, and emits nothing', () => {
  const pending: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { fromSlug: 'marriage', toSlug: 'load_bearer', kind: 'correct' }, collected: { doors: ['marriage'] } };
  const turn = applyReconnectTurn(pending, [], 'no — it really is the marriage', { text: '', replyIntent: 'dispute' });
  assert.deepEqual(turn.state.collected.doors, ['marriage'], 'their named door stands');
  assert.equal(turn.state.pendingRevision, undefined, 'pending cleared on dispute');
  assert.equal(turn.state.reseeingTells, undefined, 'no tell on a rejected re-seeing');
  assert.equal(turn.state.stage, 'doors', 'stays in the beat');
  assert.match(turn.reply, /door you named is the door|see it your way|got it wrong/i, 'takes it humbly, no defense');
});

test('reconnect revision · a non-canonical or no-op swap is ignored (the engine disposes; the model cannot force it)', () => {
  const atDoors: ConvState = { stage: 'doors', stageScratch: { doors: { doorDepth: 2 } }, collected: { doors: ['marriage'] } };
  const turn = applyReconnectTurn(atDoors, [], 'hmm', { text: 'go on', revision: { fromSlug: 'marriage', toSlug: 'not_a_door' as never, kind: 'correct' } });
  assert.notEqual(turn.state.awaitingConfirm, true, 'a non-canonical target does not open a revision confirm');
  assert.deepEqual(turn.state.collected.doors, ['marriage'], 'nothing swapped');
});

// --- WIDEN / NAME (Decision L, the ADD kinds — retire nothing; tell keyed to re-seeing, suppress on 'mechanical') ---

test('reconnect revision · WIDEN is proposed, offered, and adds NOTHING until confirmed (R1)', () => {
  const atDoors: ConvState = { stage: 'doors', stageScratch: { doors: { doorDepth: 2 } }, collected: { doors: ['marriage'] } };
  const turn = applyReconnectTurn(atDoors, [], 'my father was failing right alongside all of it', {
    text: 'The Marriage — and it sounds like The Aging Parents was open right beside it. Both at once?',
    revision: { kind: 'widen', toSlug: 'aging_parents' },
  });
  assert.equal(turn.state.awaitingConfirm, true, 'offered as a check');
  assert.deepEqual(turn.state.pendingRevision, { kind: 'widen', toSlug: 'aging_parents' });
  assert.deepEqual(turn.state.collected.doors, ['marriage'], 'nothing added until they confirm');
});

test('reconnect revision · confirming a WIDEN adds the Door (keeps primary) + emits a tell (an add, no pair)', () => {
  const pending: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { kind: 'widen', toSlug: 'aging_parents' }, collected: { doors: ['marriage'] } };
  const turn = applyReconnectTurn(pending, [], 'yeah, both were happening at the same time', { text: '', replyIntent: 'done' });
  assert.deepEqual(turn.state.collected.doors, ['marriage', 'aging_parents'], 'added as secondary; the primary is untouched');
  assert.deepEqual(turn.state.reseeingTells, [{ toSlug: 'aging_parents' }], 'a genuine surfacing emits a tell — an add carries no from-pair');
  assert.equal(turn.state.pendingRevision, undefined);
  assert.equal(turn.state.stage, 'doors');
  assert.match(turn.reply, /Aging Parents/, 'acknowledges the added Door');
});

test('reconnect revision · NAME adds a quiet Door; a MECHANICAL add commits but emits NO tell', () => {
  const named: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { kind: 'name', toSlug: 'acceptance' }, collected: { doors: ['body'] } };
  const t1 = applyReconnectTurn(named, [], "yeah — that's the quiet one, I never named it", { text: '', replyIntent: 'done' });
  assert.deepEqual(t1.state.collected.doors, ['body', 'acceptance'], 'the quiet Door is named and added');
  assert.deepEqual(t1.state.reseeingTells, [{ toSlug: 'acceptance' }], 'a genuine naming is a re-seeing → tell');

  const mech: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { kind: 'widen', toSlug: 'full_house', mechanical: true }, collected: { doors: ['grind'] } };
  const t2 = applyReconnectTurn(mech, [], 'sure, add it', { text: '', replyIntent: 'done' });
  assert.deepEqual(t2.state.collected.doors, ['grind', 'full_house'], 'the add still applies');
  assert.equal(t2.state.reseeingTells, undefined, 'a mechanical add is not a keeper — no tell (suppress-on-explicit)');
});

test('reconnect revision · a disputed add is dropped, humbly — the named set stands', () => {
  const pending: ConvState = { stage: 'doors', awaitingConfirm: true, pendingRevision: { kind: 'widen', toSlug: 'aging_parents' }, collected: { doors: ['marriage'] } };
  const turn = applyReconnectTurn(pending, [], 'no, it was really just the marriage', { text: '', replyIntent: 'dispute' });
  assert.deepEqual(turn.state.collected.doors, ['marriage'], 'nothing added on a dispute');
  assert.equal(turn.state.reseeingTells, undefined, 'no tell');
  assert.match(turn.reply, /door you named is the door|see it your way|got it wrong/i, 'humble, no defense');
});

// ============================================================================================================
// §2c Measurement (administered, slice 1) — the WALL: IDQ items delivered verbatim OFF the depth kernel; fixed-scale
// capture; authored cluster transitions; the 24th completes the baseline (the ACTION writes it) and hands on.
// ============================================================================================================

test('reconnect measurement · Doors done hands into the administered check-in (warm open + scale, not a survey wall)', () => {
  const atDoors: ConvState = { stage: 'doors', awaitingConfirm: true, collected: { identityNoun: 'Racer', doors: ['grind'] } };
  const turn = applyReconnectTurn(atDoors, [], "yeah, that's it", { text: '', replyIntent: 'done' });
  assert.equal(turn.state.stage, 'measurement', 'Doors hands into measurement');
  assert.match(turn.reply, /check-in/i, 'framed as a check-in, not a test');
  assert.match(turn.reply, /1 to 5|not at all/i, 'gives the 1–5 scale');
});

test('reconnect measurement · a 1–5 answer records in order and delivers the next item, OFF the depth kernel', () => {
  const atM: ConvState = { stage: 'measurement', collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(atM, [], '3', { text: '', depthReady: true }); // depthReady MUST have no effect here
  assert.deepEqual(turn.state.administeredResponses, [3], 'the fixed-scale response is recorded in item order');
  assert.equal(turn.state.awaitingConfirm ?? false, false, 'no reflect-confirm loop in an administered beat');
  assert.ok(turn.reply.length > 0, 'delivers the next item');
});

test('reconnect measurement · a dimension boundary carries an authored cluster transition', () => {
  const five: ConvState = { stage: 'measurement', administeredResponses: [3, 3, 3, 3, 3], collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(five, [], '4', { text: '' }); // the 6th answer → deliver item 6 (first of Self)
  assert.equal((turn.state.administeredResponses ?? []).length, 6);
  assert.match(turn.reply, /how you see yourself/i, 'a warm cluster transition into the Self items');
});

test('reconnect measurement · an unclear answer re-prompts and records nothing (stays on the item)', () => {
  const atM: ConvState = { stage: 'measurement', administeredResponses: [3, 3], collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(atM, [], 'hard to put a number on it', { text: '' });
  assert.deepEqual(turn.state.administeredResponses, [3, 3], 'no response recorded on an unclear reply');
  assert.match(turn.reply, /number/i, 'gently asks for a 1–5');
  assert.equal(turn.state.stage, 'measurement', 'stays on the current item');
});

test('reconnect measurement · the 24th response completes the baseline and hands into the Drift beat', () => {
  const almost: ConvState = { stage: 'measurement', administeredResponses: Array(TOTAL_ITEMS - 1).fill(3), collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(almost, [], '5', { text: '' });
  assert.equal((turn.state.administeredResponses ?? []).length, TOTAL_ITEMS, 'all 24 captured');
  assert.equal(turn.state.stage, 'drift', 'hands into §2d Visioning — the Drift beat');
  assert.match(turn.reply, /baseline/i, 'the close names the baseline (never a bare number; the ACTION writes it)');
  assert.match(turn.reply, /inventory|cost/i, 'and opens the Drift beat (the generic close appends the drift opener)');
});

// ============================================================================================================
// §2d VISIONING · the DRIFT beat (slice 1) — draw-out back on the depth kernel; drift-recognition KEEPER (tell);
// the turn-toward-hope BRIDGE into Legacy. (The insight QUALITY / LIFT is a felt walk; these pin the structure.)
// ============================================================================================================

test('reconnect drift · DEPTH FLOOR holds — reflect_drift on the first exchange keeps drawing out (no pattern w/o material)', () => {
  const atDrift: ConvState = { stage: 'drift', collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(atDrift, [], 'it cost me my mornings', { text: 'When did that start?', depthReady: true });
  assert.equal(turn.state.awaitingConfirm ?? false, false, 'the FLOOR overrides an early reflect_drift');
});

test('reconnect drift · past the floor, reflect_drift reflects the pattern + captures the drift declaration', () => {
  const atDrift: ConvState = { stage: 'drift', stageScratch: { drift: { driftDepth: 2 } }, collected: { doors: ['grind'] } };
  const decl = 'I stopped riding, then I stopped seeing friends, then I stopped noticing I had';
  const turn = applyReconnectTurn(atDrift, [], decl, { text: 'The drift kept taking the things that were just yours. Does that name the shape?', depthReady: true });
  assert.equal(turn.state.awaitingConfirm, true, 'reflects the pattern, awaits the check');
  assert.equal(turn.state.driftPayload, decl, "captures the member's drift declaration (their words) for the keeper");
});

test('reconnect drift · confirm queues the drift KEEPER (tell) and BRIDGES toward hope into The Window', () => {
  const pending: ConvState = { stage: 'drift', awaitingConfirm: true, driftPayload: 'I stopped riding and stopped noticing', collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(pending, [], "yeah, that's the shape of it", { text: '', replyIntent: 'done' });
  assert.equal(turn.state.stage, 'window', 'hands into The Window (beat 2)');
  assert.match(turn.reply, /look the other way/i, 'the turn-toward-hope bridge (LIFT at the seam)');
  assert.match(turn.reply, /Tuesday|window/i, 'and hands straight into The Window opener');
  assert.deepEqual(turn.state.pendingHarvest, [{ kind: 'drift', keeperType: 'tell', destinationIntent: 'keeper', payloadRef: 'I stopped riding and stopped noticing', label: 'The drift' }], 'a drift-recognition keeper is queued (default-emit)');
  assert.equal(turn.state.driftPayload, undefined, 'payload cleared after queueing');
});

// ============================================================================================================
// §2d VISIONING · beat 2: THE WINDOW (slice 2) — the two Tuesdays, the spark, the LIFT. Draw-out; on confirm the
// VISION is a keeper ('lights_you_up'); hands into the Checkpoint (§2e stub).
// ============================================================================================================

test('reconnect window · DEPTH FLOOR holds — reflect_window before both Tuesdays keeps drawing out', () => {
  const atWindow: ConvState = { stage: 'window', collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(atWindow, [], 'if nothing changes I just keep grinding', { text: 'And the other Tuesday?', depthReady: true });
  assert.equal(turn.state.awaitingConfirm ?? false, false, 'the FLOOR keeps it drawing out the second Tuesday');
});

test('reconnect window · past the floor, reflect_window reflects the SPARK + captures the vision', () => {
  const atWindow: ConvState = { stage: 'window', stageScratch: { window: { windowDepth: 2 } }, collected: { doors: ['grind'] } };
  const vision = "I'd be up at six, out on the bike before the house wakes, home strong instead of dreading the day";
  const turn = applyReconnectTurn(atWindow, [], vision, { text: 'That morning — the ride before the house wakes — that\'s the spark. Is that the one worth chasing?', depthReady: true });
  assert.equal(turn.state.awaitingConfirm, true, 'reflects the spark, awaits the check');
  assert.equal(turn.state.driftPayload, vision, "captures the member's second-Tuesday vision (their words) for the keeper");
});

test('reconnect window · confirm queues the VISION keeper (lights_you_up) and hands into the §2e Checkpoint', () => {
  // seed a stale IDQ accumulator (the 24 from §2c) to prove the Checkpoint resets it for the grit instrument
  const pending: ConvState = { stage: 'window', awaitingConfirm: true, driftPayload: 'the ride before the house wakes, home strong', collected: { doors: ['grind'] }, administeredResponses: [1, 2, 3] };
  const turn = applyReconnectTurn(pending, [], "yeah — that's the one", { text: '', replyIntent: 'done' });
  assert.equal(turn.state.stage, 'checkpoint', 'hands into the §2e Checkpoint');
  assert.match(turn.reply, /spark/i, 'the close names the spark (ends on hope)');
  assert.match(turn.reply, /1 \(not at all\)/i, 'the Checkpoint opener + first grit item are delivered');
  assert.equal(turn.state.administeredResponses?.length ?? 0, 0, 'the accumulator is reset from the IDQ responses for the grit instrument');
  assert.deepEqual(turn.state.pendingHarvest, [{ kind: 'window', keeperType: 'lights_you_up', destinationIntent: 'keeper', payloadRef: 'the ride before the house wakes, home strong', label: 'The spark' }], 'the vision is queued as a lights_you_up keeper');
});

test('reconnect window · a DISPUTE reopens and queues NO keeper', () => {
  const pending: ConvState = { stage: 'window', awaitingConfirm: true, driftPayload: 'x', collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(pending, [], "no, that's not really it", { text: '', replyIntent: 'dispute' });
  assert.equal(turn.state.stage, 'window', 'stays in The Window');
  assert.equal(turn.state.pendingHarvest, undefined, 'no keeper on a rejected vision');
  assert.match(turn.reply, /not quite the one|say more|worth chasing/i, 'keeps looking, no force');
});

test('reconnect drift · a DISPUTE reopens and queues NO keeper', () => {
  const pending: ConvState = { stage: 'drift', awaitingConfirm: true, driftPayload: 'x', collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(pending, [], "no, that's not it", { text: '', replyIntent: 'dispute' });
  assert.equal(turn.state.stage, 'drift', 'stays in the Drift beat');
  assert.equal(turn.state.awaitingConfirm ?? false, false, 'reopens');
  assert.equal(turn.state.pendingHarvest, undefined, 'no keeper on a rejected pattern');
  assert.match(turn.reply, /say it your way|not got it yet|real shape/i, 'takes the correction, no defense');
});

// --- §2c slice 2: the personalized close (M3) — the SHAPE helper + the governance-safe fallback ---------------
test('reconnect measurement · idqShape ranks the lowest + highest dimension (grounds the close, never a raw number)', async () => {
  const { idqShape } = await import('../lib/agent/reconnect.ts');
  // physical all 1 (lowest), self all 5 (highest), social 3, outlook 4
  const responses = [1,1,1,1,1,1, 5,5,5,5,5,5, 3,3,3,3,3,3, 4,4,4,4,4,4];
  assert.deepEqual(idqShape(responses), { lowest: 'physical', highest: 'self' });
});

test('reconnect measurement · the personalized close FALLS BACK to null with no API key (generic close stands)', async () => {
  const { reconnectMeasurementClose } = await import('../lib/agent/reconnect.ts');
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const out = await reconnectMeasurementClose({ identityNoun: 'Racer', doors: ['body'] }, Array(24).fill(3));
  assert.equal(out, null, 'no key → null, so the deterministic generic close is used (safe by default)');
  if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
});

// --- the SHARED draw-out tic fix (Doors + Drift + Window): a declarative reflection past the floor advances to the
// confirm instead of re-asking — "stop circling once the Companion has reflected", even without the reflect_x tool.
test('reconnect drawout · TIC FIX — a declarative reflection past the floor advances to the check (no redundant re-ask)', () => {
  // The model reflected in TEXT (a substantive statement, no trailing question) but did NOT call reflect_drift. Past
  // the floor, that IS the reflection — advance to the confirm rather than append a draw-out probe.
  const atDrift: ConvState = { stage: 'drift', stageScratch: { drift: { driftDepth: 2 } }, collected: { doors: ['grind'] } };
  const turn = applyReconnectTurn(atDrift, [], 'yeah, all of it went quiet', { text: 'The drift kept taking the things that were just yours, one reasonable decision at a time.' });
  assert.equal(turn.state.awaitingConfirm, true, 'recognizes the declarative reflection and moves to the check');
  assert.match(turn.reply, /name the shape|is it different/i, 'appends the confirm question, not another draw-out probe');
});

test('reconnect drawout · TIC FIX still respects the floor — a declarative statement on turn 1 does NOT advance', () => {
  const atWindow: ConvState = { stage: 'window', collected: { doors: ['grind'] } }; // windowDepth 0 → 1 (below floor)
  const turn = applyReconnectTurn(atWindow, [], 'if nothing changes I just keep grinding', { text: 'That Tuesday is real. You named it plainly.' });
  assert.equal(turn.state.awaitingConfirm ?? false, false, 'the FLOOR still holds — one exchange is not a reflection');
});

// --- §2e Checkpoint (administered grit beat) + §2f Ceremony terminal --------------------------------------------
test('reconnect §2e Checkpoint · administers the 6 grit items → Ceremony; grinta is NOT named to the member', () => {
  let s: ConvState = { stage: 'checkpoint', collected: { doors: ['grind'] }, administeredResponses: [] };
  // an unclear answer re-asks the current item, records nothing, does not advance
  const bad = applyReconnectTurn(s, [], 'not sure', { text: '' });
  assert.equal(bad.state.stage, 'checkpoint');
  assert.equal(bad.state.administeredResponses?.length ?? 0, 0, 'nothing recorded on an unclear answer');
  assert.match(bad.reply, /number, 1 to 5/i, 'gently re-asks with the scale');
  // walk the six grit items
  let reply = '';
  for (let i = 0; i < 6; i++) {
    const t = applyReconnectTurn(s, [], '5', { text: '' });
    s = t.state;
    reply = t.reply;
  }
  assert.equal(s.stage, 'ceremony', 'the 6th grit answer hands into the Ceremony');
  assert.deepEqual(s.administeredResponses, [5, 5, 5, 5, 5, 5], 'the six grit responses are captured');
  assert.match(reply, /don’t go anywhere|show you what you just did/i, 'the close hands into the Ceremony lead');
  assert.doesNotMatch(reply, /grinta|hardiness/i, 'grinta is never named to the member here — it surfaces in the Ceremony');
});
