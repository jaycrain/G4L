import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rewireEnabled,
  rewireOpening,
  applyRewireTurn,
  rewireW2Opening,
  applyRewireW2Turn,
  memberPickedAnchor,
  rewireW3Opening,
  applyRewireW3Turn,
} from '../lib/agent/rewire.ts';
import type { Collected, ConvState } from '../lib/agent/onboarding.ts';
import { BEAT_SEP } from '../lib/agent/onboarding.ts';

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

// W-39: on the last domain the model owns ONE flowing turn — receive → reveal → seed → ask. Offline stand-in.
const LAST_DOMAIN_BEAT =
  "That last one — that it’s too late — is a heavy thing to carry, and you said it plainly. " +
  "Look at all five together: each sounds reasonable, and each keeps you where you are — that’s the campaign on autopilot, and you just made it visible. " +
  "You’ve been speaking true lines all session, in your own words. " +
  "What’s the honest line you’d put in place of “it’s too late”?";

// Walk the opener + the five domains; returns the state at the turn (affirm stage).
function walkDomains(): ConvState {
  let t = rewireOpening();
  assert.equal(t.state.stage, 'domains');
  assert.match(t.reply, /disinformation campaign/i, 'opens on Jay’s story (third person)');
  FIVE_LIES.forEach((lie, i) => {
    assert.equal(t.state.stage, 'domains', 'still walking the domains');
    const last = i === FIVE_LIES.length - 1;
    t = applyRewireTurn(t.state, [], lie, { text: last ? LAST_DOMAIN_BEAT : 'That’s the story.' });
  });
  assert.equal(t.state.stage, 'affirm', 'after the fifth domain, hands into the turn');
  // W-39: the model's full beat passes through (no scripted double), receive FIRST, then reveal, then ask.
  assert.match(t.reply, /heavy thing to carry/, 'receives the member’s fifth admission first');
  assert.match(t.reply, /campaign/i, 'names the campaign as the reveal');
  assert.match(t.reply, /honest line/i, 'poses the turn ask');
  assert.ok(t.reply.indexOf('carry') < t.reply.indexOf('campaign'), 'the receive lands BEFORE the analysis (W-39)');
  // No double-beat: the scripted campaign copy must NOT be appended onto the model's own full turn.
  assert.doesNotMatch(t.reply, /running on autopilot/, 'the scripted W1_CAMPAIGN is not doubled onto the model beat');
  return t.state;
}

// The fallback path: model returns nothing at the last domain → the scripted reveal + ask stand in.
test('W1 last-domain FALLBACK — empty model turn → scripted campaign reveal + ask (never blank)', () => {
  let t = rewireOpening();
  FIVE_LIES.forEach((lie, i) => {
    t = applyRewireTurn(t.state, [], lie, { text: i === FIVE_LIES.length - 1 ? '' : 'noted' });
  });
  assert.equal(t.state.stage, 'affirm');
  assert.match(t.reply, /running on autopilot/, 'falls back to the scripted campaign reveal');
  assert.match(t.reply, /honest line/i, 'and the scripted ask');
});

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
  assert.match(t.reply, /clear picture of the person you want to become/i, 'opens on the value (through-line from W1)');
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

test('W2 · the last-image reflection must not STRAND a trailing question before the recognition (Millie walk)', () => {
  // Bug: on the final piece the engine appended the scripted recognition onto the model's reflection — but if the
  // model ended by ASKING ("Is anyone with you, or is this your solo moment?"), that question got stranded, unanswered,
  // right before "That's not a wish…". The reflection here must be a RECEIPT: the trailing question is stripped.
  let t = rewireW2Opening(CAPTURES);
  t = applyRewireW2Turn(t.state, [], 'The half-marathon finish line', { text: "The half-marathon — let's stand you there." });
  const PIECES = ['A cool morning, the finish chute', 'Lighter, steadier, proud', 'My kids at the rail', 'Like I came back'];
  PIECES.forEach((piece, i) => {
    const last = i === PIECES.length - 1;
    const modelText = last
      ? 'There you are — lighter, proud, your kids at the rail. Is anyone with you, or is this your solo moment?'
      : 'I can see it.';
    t = applyRewireW2Turn(t.state, [], piece, { text: modelText });
  });
  assert.equal(t.state.stage, 'hold', 'still hands into the reveal');
  assert.match(t.reply, /that's not a wish/i, 'delivers the recognition');
  assert.doesNotMatch(t.reply, /is anyone with you|solo moment/i, "the model's trailing question is stripped — never stranded before the recognition");
});

test('W2 · graceful degrade — thin captures still open and walk (the model offers from context)', () => {
  const t = rewireW2Opening(null);
  assert.equal(t.state.stage, 'anchor');
  assert.match(t.reply, /which one do you want to visualize/i, 'falls back to the approved generic pick copy');
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


// ── Rewire (v2.3) SLICE 3 — W3 the False Start Protocol ────────────────────────────────────────────────────────
// The MODEL owns the questioning (draw-out); the engine sequences + never appends a question. Its turn IS the reply.
// Draw out ~3 exchanges → protocol (model acks + poses each move, offering the member's REAL keepers). Assertions key
// on STRUCTURE, sequencing, and harvest (the model's warm text is verified by the live felt-walk, not offline).
const W3_CB = {
  trueLines: ["I won't know what I'm capable of until I try"],
  image: 'Me at the finish line, my kids at the rail',
  reclaimList: ['Run the half again'],
  identityNoun: 'Runner',
};

// Draw out three trigger exchanges → returns state at the protocol stage (the model posed the Redirect on the 3rd).
function walkTriggers(cb = W3_CB): ConvState {
  let t = rewireW3Opening(cb);
  assert.equal(t.state.stage, 'triggers');
  assert.match(t.reply, /not failure/i, 'opens with the reframe — permission');
  const digs = ['Brutal weeks', 'When I feel invisible', 'Late nights'];
  digs.forEach((trig, i) => {
    assert.equal(t.state.stage, 'triggers', 'still drawing out');
    const last = i === digs.length - 1;
    // the model's turn IS the reply; on the last it names the heaviest + poses the Redirect
    t = applyRewireW3Turn(t.state, [], trig, { text: last ? 'Those are the heaviest — so what do you do instead?' : 'Say more — what is that like?' });
  });
  assert.equal(t.state.stage, 'protocol', 'after ~3 exchanges, hands into the protocol');
  return t.state;
}

test('W3 · draws out over exchanges (model owns the question), then the protocol builds; harvests both keepers', () => {
  const state = walkTriggers();
  assert.equal((state.collected.w3Triggers ?? []).length, 3, 'each trigger exchange captured');
  // Redirect answered → the model acks + poses Reframe (its warm turn IS the reply)
  let t = applyRewireW3Turn(state, [], 'Walk the block', { text: 'A real redirect. Now — the true line for a bad day?' });
  assert.match(t.reply, /true line for a bad day/i, "the model's turn leads");
  assert.equal(t.state.collected.w3Redirect, 'Walk the block');
  // Reframe (a NEW line) → harvest principle; model poses Restart
  t = applyRewireW3Turn(t.state, [], 'A slip is the toll for changing, not proof I stop', { text: 'That has teeth. Go back to your picture — does it hold?' });
  assert.equal((t.state.pendingHarvest ?? []).length, 1, 'the new bad-day line is harvested');
  assert.equal((t.state.pendingHarvest ?? [])[0]!.keeperType, 'principle');
  // Restart answered → protocol harvested (recovery_move), then GREG'S STAGE 3 + 4 rather than the close.
  // Added 2026-08-22: the session used to end here, so a member built a protocol and a tracking grid appeared
  // without her ever being asked whether she was willing or when she would check in.
  t = applyRewireW3Turn(t.state, [], 'it does', { text: 'Then you already know the way back.' });
  assert.equal(t.complete, false, 'the protocol no longer ends the session — the commitment does');
  assert.equal(t.state.stage, 'commit');
  assert.match(t.reply, /forgetting a day is normal/i, "Stage 3's expectations are stated");
  assert.match(t.reply, /willing to track this for the next week/i, "Stage 4's first ask, in Greg's words");

  // Willingness answered → the cue ask. The ENGINE poses this one: its answer is a stored field.
  t = applyRewireW3Turn(t.state, [], 'yes, I can do that', { text: 'Good.' });
  assert.equal(t.complete, false);
  assert.match(t.reply, /natural time for you to check in/i);

  // The cue itself — captured VERBATIM, and it becomes the week's first row.
  t = applyRewireW3Turn(t.state, [], 'after I put the kids down', { text: '' });
  assert.equal(t.state.collected.w3CheckInCue, 'after I put the kids down', 'her words, not a tidied version');
  assert.match(t.reply, /Both are data\. Neither is a verdict\./, "Stage 4's frame, in Greg's words");
  assert.equal(t.complete, true);
  assert.equal(t.state.stage, 'complete', 'terminal stage hides the input');
  const protocol = (t.state.pendingHarvest ?? []).find((h) => h.keeperType === 'recovery_move');
  assert.match(protocol!.payloadRef, /Walk the block/, 'protocol carries their Redirect');
  assert.match(protocol!.payloadRef, /toll for changing/, 'and their Reframe line');
});

test('W3 · fallbacks (model empty) surface the REAL keepers + a forward invite; no codenames', () => {
  const state = walkTriggers();
  const NO_CODENAME = /\bW[123]\b/;
  // model empty at the protocol → deterministic fallbacks still offer their real line + picture
  let t = applyRewireW3Turn(state, [], 'Walk the block', { text: '' });
  assert.match(t.reply, /I won't know what I'm capable of/, 'Reframe fallback offers the real line');
  assert.match(t.reply, /write a new one/i, 'propose-confirm');
  assert.doesNotMatch(t.reply, NO_CODENAME);
  t = applyRewireW3Turn(t.state, [], 'A fresh true line', { text: '' });
  assert.match(t.reply, /finish line, my kids at the rail/, 'Restart fallback points to the real picture');
  assert.match(t.reply, /reach for/i, 'and invites forward (not a dead end)');
  assert.doesNotMatch(t.reply, NO_CODENAME);
});

test('W3 · Reframe reuse (propose-confirm) — confirming the offered line adds NO duplicate keeper', () => {
  const state = walkTriggers();
  let t = applyRewireW3Turn(state, [], 'Leave the room', { text: '' });
  t = applyRewireW3Turn(t.state, [], 'use that one', { text: '' }); // confirm the offered line
  assert.equal((t.state.pendingHarvest ?? []).length, 0, 'a reused line is already kept — no duplicate');
  assert.equal(t.state.collected.w3Reframe, "I won't know what I'm capable of until I try");
  t = applyRewireW3Turn(t.state, [], 'ok', { text: '' });
  const protocol = (t.state.pendingHarvest ?? []).find((h) => h.keeperType === 'recovery_move');
  assert.match(protocol!.payloadRef, /capable of/);
  assert.equal((t.state.pendingHarvest ?? []).filter((h) => h.keeperType === 'principle').length, 0);
});

test('W3 · graceful degrade (no prior tools) still walks; a blank trigger is nudged', () => {
  const blank = applyRewireW3Turn(rewireW3Opening(W3_CB).state, [], '', { text: '' });
  assert.equal(blank.state.stage, 'triggers');
  assert.match(blank.reply, /no wrong answer/i);
  const state = walkTriggers({ trueLines: [], image: undefined, reclaimList: [], identityNoun: undefined });
  let t = applyRewireW3Turn(state, [], 'Leave the room', { text: '' });
  assert.match(t.reply, /Reframe/i, 'generic Reframe fallback');
  t = applyRewireW3Turn(t.state, [], "One bad day isn't the story", { text: '' });
  assert.match(t.reply, /Restart/i, 'generic Restart fallback');
  t = applyRewireW3Turn(t.state, [], 'ok', { text: '' });
  assert.equal((t.state.pendingHarvest ?? []).filter((h) => h.keeperType === 'recovery_move').length, 1);
  // The commitment still runs with an EMPTY model on every turn — Stage 3 and 4 are engine copy and engine asks,
  // so a member whose model returns nothing is never stranded before the week opens.
  assert.equal(t.state.stage, 'commit');
  t = applyRewireW3Turn(t.state, [], 'sure', { text: '' });
  assert.match(t.reply, /natural time for you to check in/i, 'the cue is asked even with no model text');
  t = applyRewireW3Turn(t.state, [], 'with my morning coffee', { text: '' });
  assert.equal(t.state.collected.w3CheckInCue, 'with my morning coffee');
  assert.equal(t.complete, true);

  // AND A SKIP IS A REAL ANSWER. She is never blocked: a shrug at the cue gets ONE nudge, then the week opens
  // without a first row rather than with a label we invented for her.
  let skip = applyRewireW3Turn(t.state, [], 'ok', { text: '' });
  assert.equal(skip.complete, true, 'a completed arc stays completed');
});
