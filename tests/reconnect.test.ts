import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconnectCallback, reconnectOpening, applyReconnectTurn, reconnectEnabled } from '../lib/agent/reconnect.ts';
import type { Collected, ConvMessage, ConvState } from '../lib/agent/onboarding.ts';

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
  const turn = applyReconnectTurn(atEntry, [], "actually it was really my divorce, not the grind", { text: 'Okay.' });
  assert.equal(turn.state.stage, 'doors', 'hands into the Doors excavation');
  assert.deepEqual(turn.state.collected.doors, ['grind'], 'no revision committed at entry — captures untouched');
  assert.match(turn.reply, /The Grind/, 'opens the real excavation on the primary door (not a stub anymore)');
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
