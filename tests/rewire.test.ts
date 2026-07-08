import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewireEnabled, rewireOpening, applyRewireTurn, rewireW2Opening, applyRewireW2Turn, memberPickedAnchor } from '../lib/agent/rewire.ts';
import type { Collected, ConvState } from '../lib/agent/onboarding.ts';

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
  // first true line → harvested; the Companion SERVES UP the next heaviest lie (guided, not passive)
  const NEXT_ASK = "Kept. The one about your time weighed heavy too — what's the true line there?";
  let t = applyRewireTurn(state, [], 'My body responds to what I ask of it — at any age', { text: NEXT_ASK });
  assert.equal((t.state.pendingHarvest ?? []).length, 1, 'first true line harvested');
  assert.equal(t.reply, NEXT_ASK, 'the ack serves up the next lie (model-driven), not a passive prompt');
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

test('W1 · the close moves to stage "complete" so the chat hides the input', () => {
  let state = walkDomains();
  let t = applyRewireTurn(state, [], 'My body responds to what I ask of it', { text: 'ok' });
  t = applyRewireTurn(t.state, [], "that's my set", { text: 'ok' });
  assert.equal(t.complete, true);
  assert.equal(t.state.stage, 'complete', 'terminal turn advances stage to complete');
});

// ── Rewire (v2.3) SLICE 2 — W2 the Visualization Workshop ──────────────────────────────────────────────────────
// Reads the Reclaim List (callback seam) → anchor a vivid goal → build the scene ONE PIECE at a time → the reveal →
// practice + close, harvesting the finished image as ONE keeper. Assertions key on STRUCTURE, the callback, + harvest.

const CAPTURES: Collected = {
  identityNoun: 'Runner',
  reclaimList: ['Run the half-marathon again', 'Trip to the coast with the guys', 'Feel strong in my body'],
  doors: [],
  gap: 'work swallowed everything',
};

// Walk the opener → pick the anchor → build the 4 image pieces; returns the state at hold (the reveal delivered).
function walkImage(committed: Collected | null = CAPTURES): { state: ConvState; recognitionReply: string } {
  let t = rewireW2Opening(committed);
  assert.equal(t.state.stage, 'anchor');
  assert.match(t.reply, /clear picture of the person you're becoming/i, 'opens on the value (through-line from W1)');
  // pick the anchor goal → advances into the image build with the first scene prompt
  t = applyRewireW2Turn(t.state, [], 'The half-marathon finish line', { text: "The half-marathon — let's stand you there." });
  assert.equal(t.state.stage, 'image', 'a picked goal advances to the image build');
  assert.equal(t.state.collected.w2Anchor, 'The half-marathon finish line', 'the chosen goal is stashed');
  const PIECES = ['A cool morning, the finish chute', 'Lighter, steadier, proud', 'My kids at the rail', 'Like I came back'];
  PIECES.forEach((piece, i) => {
    assert.equal(t.state.stage, 'image', 'still building the scene');
    const last = i === PIECES.length - 1;
    t = applyRewireW2Turn(t.state, [], piece, { text: last ? 'That whole picture — you, back.' : 'I can see it.' });
  });
  assert.equal(t.state.stage, 'hold', 'after the fourth piece, hands into the reveal');
  assert.match(t.reply, /that's not a wish/i, 'delivers the recognition reveal');
  return { state: t.state, recognitionReply: t.reply };
}

test('W2 · flag OFF hides the arc; the anchor pulls from the Reclaim List; the scene builds one piece at a time', () => {
  const { state } = walkImage();
  assert.equal((state.collected.w2Image ?? []).length, 4, 'all four scene pieces captured, in order');
  assert.deepEqual(state.collected.w2Image, ['A cool morning, the finish chute', 'Lighter, steadier, proud', 'My kids at the rail', 'Like I came back']);
});

test('W2 · the reveal → practice + close, harvesting the finished image as ONE keeper; completes at stage complete', () => {
  const { state } = walkImage();
  const t = applyRewireW2Turn(state, [], 'that lands', { text: 'Hold onto it.' });
  assert.equal(t.complete, true, 'W2 completes after the member sits with the reveal');
  assert.equal(t.state.stage, 'complete', 'terminal stage so the chat hides the input');
  assert.match(t.reply, /saved your picture to your Playbook/i, 'the close names the keeper');
  const harvest = t.state.pendingHarvest ?? [];
  assert.equal(harvest.length, 1, 'the finished image is ONE keeper (not four)');
  assert.equal(harvest[0]!.keeperType, 'lights_you_up', 'the image is a lights-you-up keeper');
  assert.equal(harvest[0]!.destinationIntent, 'keeper');
  assert.match(harvest[0]!.payloadRef, /finish line/, 'the keeper carries the goal + the scene, the member’s words');
  assert.match(harvest[0]!.payloadRef, /My kids at the rail/, 'the keeper carries every scene piece');
});

test('W2 · graceful degrade — thin captures still open and walk (the model offers from context)', () => {
  const t = rewireW2Opening(null);
  assert.equal(t.state.stage, 'anchor');
  assert.match(t.reply, /pick the one that pulls hardest/i, 'falls back to the approved generic pick copy');
});

test('W2 · "not sure" holds at the anchor (the model offers candidates); a real pick advances', () => {
  let t = rewireW2Opening(CAPTURES);
  const unsure = applyRewireW2Turn(t.state, [], "I'm not sure", { text: 'From your list: the half, the coast trip, feeling strong — which pulls hardest?' });
  assert.equal(unsure.state.stage, 'anchor', 'an unsure reply keeps helping at the anchor');
  assert.match(unsure.reply, /which pulls hardest/i, 'the model offers candidates from their list');
  const picked = applyRewireW2Turn(unsure.state, [], 'the coast trip', { text: 'The coast it is.' });
  assert.equal(picked.state.stage, 'image', 'a real pick advances to the build');
});

test('memberPickedAnchor · unsure vs. a real pick', () => {
  assert.equal(memberPickedAnchor("I'm not sure"), false);
  assert.equal(memberPickedAnchor('idk'), false);
  assert.equal(memberPickedAnchor('you pick'), false);
  assert.equal(memberPickedAnchor('the half-marathon'), true);
  assert.equal(memberPickedAnchor('getting my marriage back on track'), true);
});
