import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconnectCallback, reconnectOpening, applyReconnectTurn, reconnectEnabled } from '../lib/agent/reconnect.ts';
import type { Collected, ConvState } from '../lib/agent/onboarding.ts';

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

test('reconnect · the callback is READ-ONLY — a first response hands into Doors and revises NOTHING', () => {
  const committed: Collected = { identityNoun: 'Player', doors: ['grind'], gap: 'The grind took over.' };
  const atEntry: ConvState = { stage: 'entry', collected: committed };
  // Even an explicit correction at the callback does not mutate captures this increment (revision is §2b).
  const turn = applyReconnectTurn(atEntry, [], "actually it was really my divorce, not the grind", { text: 'Okay.' });
  assert.equal(turn.state.stage, 'doors', 'hands into the Doors excavation');
  assert.deepEqual(turn.state.collected.doors, ['grind'], 'no revision committed here — captures untouched (deferred to §2b)');
  assert.match(turn.reply, /Reconnect · doors/, 'reaches the Doors stub (built next increment)');
});
