import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewireEnabled, rewireOpening, applyRewireTurn } from '../lib/agent/rewire.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

// Rewire (v2.3) SLICE 1 — W1 the Disinformation Audit. Final approved copy; the arc walks the FIVE domains one at a
// time → the turn → harvests each true line as a Playbook keeper. Assertions key on STRUCTURE + harvest.

test('rewire · flag defaults OFF (prod keeps v1 static Rewire until the v2.3 flip)', () => {
  const prev = process.env.REWIRE;
  delete process.env.REWIRE;
  assert.equal(rewireEnabled(), false);
  process.env.REWIRE = 'staged';
  assert.equal(rewireEnabled(), true);
  if (prev === undefined) delete process.env.REWIRE;
  else process.env.REWIRE = prev;
});

const FIVE_LIES = [
  "it's just age",
  'the extra drink helps me unwind',
  "no room for me, work's crazy",
  "I'm not that person anymore",
  "I've tried before and it didn't take",
];

// The guided turn ask the model produces on the last domain (offline stand-in for the live last-domain note).
const TURN_ASK = "The one about your body sounded like it holds the most weight — what's the honest line you'd put in its place?";

// Walk the opener + the five domains; returns the state at the turn (affirm stage).
function walkDomains(): ConvState {
  let t = rewireOpening();
  assert.equal(t.state.stage, 'domains');
  assert.match(t.reply, /disinformation campaign/i, 'opens on Jay’s story (third person)');
  FIVE_LIES.forEach((lie, i) => {
    assert.equal(t.state.stage, 'domains', 'still walking the domains');
    const last = i === FIVE_LIES.length - 1;
    t = applyRewireTurn(t.state, [], lie, { text: last ? TURN_ASK : 'That’s the story.' });
  });
  assert.equal(t.state.stage, 'affirm', 'after the fifth domain, hands into the turn');
  assert.match(t.reply, /campaign/i, 'NAMES THE CAMPAIGN as the reveal before the turn');
  assert.match(t.reply, /honest line/i, 'then poses the guided, one-at-a-time turn ask');
  return t.state;
}

test('W1 · walks all five domains, then the turn HARVESTS each true line as a keeper; closing completes', () => {
  let state = walkDomains();
  // write two true lines (the ones that hit hardest — a member-picked subset)
  let t = applyRewireTurn(state, [], 'My body responds to what I ask of it — at any age', { text: 'ok' });
  assert.equal((t.state.pendingHarvest ?? []).length, 1, 'first true line harvested');
  t = applyRewireTurn(t.state, [], "I've started before — this time I'm not alone", { text: 'ok' });
  assert.equal((t.state.pendingHarvest ?? []).length, 2, 'second true line harvested');
  const k = (t.state.pendingHarvest ?? [])[0]!;
  assert.equal(k.keeperType, 'principle', 'a true line is a principle keeper');
  assert.equal(k.destinationIntent, 'keeper');
  assert.match(k.payloadRef, /at any age/, 'the keeper carries the member’s verbatim true line');
  // closing → W1 completes
  t = applyRewireTurn(t.state, [], "that's it", { text: 'ok' });
  assert.equal(t.complete, true, 'W1 completes when the member closes the set');
  assert.equal((t.state.pendingHarvest ?? []).length, 2, 'no phantom keeper on close');
});

test('W1 · a blank domain answer is nudged (not skipped); no true line yet → nudged, not completed', () => {
  // blank at a domain → nudge, stay on the domain
  let t = rewireOpening();
  const blank = applyRewireTurn(t.state, [], '...', { text: '' });
  assert.equal(blank.state.stage, 'domains', 'a blank does not advance the domain walk');
  assert.match(blank.reply, /no wrong answer/i, 'invites the real story');
  // at the turn with nothing written → nudge, not complete
  const atTurn = walkDomains();
  const early = applyRewireTurn(atTurn, [], "that's it", { text: 'ok' });
  assert.equal(early.complete ?? false, false, 'closing before any true line does not complete');
  assert.match(early.reply, /even one is enough/i, 'nudges for at least one true line');
});
