import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewireW3Opening, applyRewireW3Turn } from '../lib/agent/rewire.ts';

// Donna's #13 — the worst arc bug, two failures in the W3 False Start Protocol Reframe:
//   #13a (governance / Contract 3): the model FABRICATED "the line you wrote" and put words in her mouth.
//   #13b (advance / Contract 2): her dispute got harvested as a keeper AND skipped Restart to the close.
// Both land here as regression fixtures. Setup mirrors rewire.test's walkTriggers.

const CB = {
  trueLines: ["I won't know what I'm capable of until I try"],
  image: 'Me at the finish line, my kids at the rail',
  reclaimList: ['Run the half again'],
  identityNoun: 'Runner',
};

function toProtocol() {
  let t = rewireW3Opening(CB);
  const digs = ['Brutal weeks', 'When I feel invisible', 'Late nights'];
  digs.forEach((trig, i) => {
    t = applyRewireW3Turn(t.state, [], trig, { text: i === digs.length - 1 ? 'Those are the heaviest — so what do you do instead?' : 'Say more — what is that like?' });
  });
  assert.equal(t.state.stage, 'protocol', 'reached the protocol');
  return t.state;
}

test('#13a — the Reframe serves the member’s REAL line; a model fabrication never reaches her', () => {
  const state = toProtocol();
  // idx 0: she answers Redirect. Feed a model turn that FABRICATES a line — the engine must ignore it (Contract 3).
  const t = applyRewireW3Turn(state, [], 'Walk the block', {
    text: 'Go back to the line you wrote: "I am not a victim of my circumstances." Does it still feel true?',
  });
  assert.match(t.reply, /I won't know what I'm capable of until I try/, 'presents HER real captured line');
  assert.doesNotMatch(t.reply, /I am not a victim of my circumstances/, "the model's invented line never reaches her");
});

test('#13b — a dispute at the Reframe recovers and STAYS: never harvested, Restart never skipped', () => {
  const state = toProtocol();
  let t = applyRewireW3Turn(state, [], 'Walk the block', { text: 'A real redirect.' }); // idx 0 → Reframe presented
  const harvestsBefore = (t.state.pendingHarvest ?? []).length;

  // idx 1: she disputes the offered line.
  t = applyRewireW3Turn(t.state, [], "I didn't write that line. Where did it come from?", { text: 'here is your work this week…' });
  assert.notEqual(t.complete, true, 'a dispute does NOT complete the protocol');
  assert.equal(t.state.stage, 'protocol', 'still on the protocol, recovering — Restart not skipped');
  assert.equal((t.state.pendingHarvest ?? []).length, harvestsBefore, 'the dispute is NOT harvested as a keeper');
  assert.match(t.reply, /wasn't your line|your words/i, 'the Companion owns the error');

  // now a real bad-day line → advances PAST Reframe to Restart (idx 2 — not skipped to the close), harvests HER line.
  t = applyRewireW3Turn(t.state, [], 'A slip is the toll for changing, not proof I stop', { text: 'That has teeth — go back to your picture.' });
  assert.equal((t.state.stageScratch?.protocol as { moveIdx?: number } | undefined)?.moveIdx, 2, 'advanced to Restart (idx 2), Restart not skipped');
  assert.equal(t.complete, false, 'not complete yet — Restart still comes before the close');
  assert.ok((t.state.pendingHarvest ?? []).some((h) => /toll for changing/.test(h.payloadRef)), 'HER real line is the one harvested, never the dispute');
});


// ── THE APOLOGY THAT REPEATED ITSELF ─────────────────────────────────────────────────────────────────────────
//
// Found by the Rewire leg of the gate on its FIRST run, 2026-09-02 — the night the leg was written, on a Session
// no automated walk had ever reached.
//
//   COMPANION: …here's one you already wrote: "…" — want that as your bad-day line?
//   MARIE:     That's not mine — I never said that. Where is that from?
//   COMPANION: You're right — that wasn't your line, and I shouldn't have put it in your mouth. …here's one you
//              already wrote: "…"
//   MARIE:     You're doing it again — that quote still isn't mine.
//   COMPANION: You're right — that wasn't your line… …here's one you already wrote: "…"
//   MARIE:     You've apologized twice and then used the same false quote a third time.
//
// #13b above already covered the dispute — it checked that we do not harvest it, do not complete, and do not skip
// Restart, and it passed throughout. What nobody had asserted was what the Companion SAYS NEXT. `w3ReframeRecover`
// apologised and then called `reframeFallback`, which re-quotes `w3TrueLines[0]` — the rejected line. The recovery
// could only ever repeat the thing it was apologising for.
//
// Words attributed to a member that she did not say, restated after she corrects us, is the governance line this
// product exists on the right side of. [[their-own-words-back]] [[member-words-outrank-model-guess]]

test('a disputed line is never quoted back — the apology asks for HER words instead', () => {
  const state = toProtocol();
  let t = applyRewireW3Turn(state, [], 'Walk the block', { text: 'A real redirect.' });
  const offered = t.reply;
  assert.match(offered, /I won't know what I'm capable of until I try/, 'the captured line is offered first (unchanged)');

  t = applyRewireW3Turn(t.state, [], "That's not mine — I never said that. Where is that from?", { text: '' });
  assert.doesNotMatch(t.reply, /I won't know what I'm capable of until I try/,
    'the rejected line was quoted straight back inside the apology for quoting it');
  assert.match(t.reply, /wasn't your line/i, 'the apology still lands');
  assert.match(t.reply, /Say it your way|true line for a bad day/i, 'and she is asked for her own words');
});

test('and it is dropped from her record, not merely skipped for a turn', () => {
  // composeProtocol stamps the Reframe into the saved False Start Protocol — the artifact she keeps. A line she
  // has disowned must not survive in w3TrueLines to be quoted by a later beat or written into that keeper.
  const state = toProtocol();
  let t = applyRewireW3Turn(state, [], 'Walk the block', { text: 'A real redirect.' });
  t = applyRewireW3Turn(t.state, [], "I didn't write that. That's not mine.", { text: '' });
  const left = (t.state.collected as { w3TrueLines?: string[] }).w3TrueLines ?? [];
  assert.ok(!left.some((l) => /I won't know what I'm capable of until I try/.test(l)),
    `the disowned line is still in her record: ${JSON.stringify(left)}`);
});

test('DISPUTING TWICE CANNOT HAPPEN — there is nothing left to dispute', () => {
  // The loop had no bound: every dispute re-offered the same line, so it could run as long as she kept objecting.
  // Marie stopped at three because she gave up and wrote her own.
  const state = toProtocol();
  let t = applyRewireW3Turn(state, [], 'Walk the block', { text: 'A real redirect.' });
  const replies: string[] = [];
  for (let i = 0; i < 3; i++) {
    t = applyRewireW3Turn(t.state, [], "That's not mine — I never said that.", { text: '' });
    replies.push(t.reply);
  }
  assert.ok(!replies.some((r) => /I won't know what I'm capable of until I try/.test(r)),
    'the disputed line came back on a later objection');
});

// ── THE LINE THAT WAS NEVER HERS IN THE FIRST PLACE ──────────────────────────────────────────────────────────
//
// The Rewire gate, second full run (2026-09-02). Last night's fix stopped the apology repeating a disputed quote;
// with the loop gone, the ROOT cause was finally visible in one line:
//
//   COMPANION: …That one has the supper club in it. The friend you haven't called.
//              So — what's the true                          ← truncated at max_tokens: 300
//   MARIE:     I notice you cut off mid-sentence there. What are you asking me?
//   …
//   COMPANION: Now Reframe — your true line for a bad day. Here's one you already wrote:
//              "I notice you cut off mid-sentence there. What are you asking me?"
//
// One bug made three. A cap too small for W1's longest beat showed her half a sentence; her remark ABOUT that was
// committed as one of her true lines; and W3 handed it back to her as something she had written.
//
// `isConversationalMeta` and `isAboutTheApp` were already imported in this file and already guarding the W2 image
// harvest. W1 — where the lines that survive into every later Session are made — never got them.

import { applyRewireTurn } from '../lib/agent/rewire.ts';

test('a remark about the conversation is never committed as a true line', () => {
  const at = { stage: 'affirm', collected: { w1Lies: ['I will get to it'] } } as unknown as ConvState;
  for (const meta of [
    'I notice you cut off mid-sentence there. What are you asking me?', // hers, verbatim, from the gate
    'You already asked me that. I just answered it.',
    'Is this thing broken?',
  ]) {
    const t = applyRewireTurn(at, [], meta, { text: 'Sorry about that.' });
    const harvested = (t.state.pendingHarvest ?? []).filter((h) => h.kind === 'affirmation');
    assert.equal(harvested.length, 0, `committed as her true line: "${meta}"`);
  }
});

test('and a REAL true line still lands — the guard must not eat the beat', () => {
  // The failure in the other direction, and the expensive one: over-filtering loses the thing W1 exists to make.
  const at = { stage: 'affirm', collected: { w1Lies: ['I will get to it'] } } as unknown as ConvState;
  const t = applyRewireTurn(at, [], 'A slip is the toll for changing, not proof I stop.', { text: 'That has teeth.' });
  const harvested = (t.state.pendingHarvest ?? []).filter((h) => h.kind === 'affirmation');
  assert.equal(harvested.length, 1, 'her real line must still be kept');
  assert.match(harvested[0]!.payloadRef, /toll for changing/);
});

// A KNOWN GAP, RECORDED RATHER THAN ASSERTED AWAY. `isConversationalMeta` matches "You already asked me that. I
// just answered it." and NOT the bare "You already asked me that." — its already-answered matcher wants both
// halves. So a one-clause version of the same protest can still be committed as a true line.
//
// Not widened here on purpose: that matcher is shared with the onboarding gap capture and the Reclaim List, and
// loosening it at speed is how a guard against one bad capture becomes the cause of three. Written down so the
// next person sees a bounded gap rather than assuming this file covers the shape. [[existence-is-not-the-assertion]]
test.skip('KNOWN GAP — a one-clause protest is still harvestable as a true line', () => {
  const at = { stage: 'affirm', collected: { w1Lies: ['I will get to it'] } } as unknown as ConvState;
  const t = applyRewireTurn(at, [], 'You already asked me that.', { text: 'Sorry.' });
  assert.equal((t.state.pendingHarvest ?? []).filter((h) => h.kind === 'affirmation').length, 0);
});

// ── THE TWIN BRANCH ──────────────────────────────────────────────────────────────────────────────────────────
//
// Fixing the dispute path left the identical failure one `if` below it, and the gate found it on the very next
// run — three hours later, same evening:
//
//   COMPANION: …here's one you already wrote: "Marie the chef still exists — she just doesn't have a kitchen…"
//   MARIE:     That one's close but it's not quite right anymore… Something more like: "I still know how to feed
//              myself, not just everyone else."
//   COMPANION: Good — let's get it exactly how you'd say it.
//              …here's one you already wrote: "Marie the chef still exists — she just doesn't have a kitchen…"
//   MARIE:     You already asked me that. I just answered it.
//
// Both branches called `reframeFallback`, so both could only answer "that isn't right" by saying it again. The
// difference between them is whether she is correcting US (dispute — she never wrote it) or correcting HERSELF
// (tweak — she wrote it and it has stopped fitting). Neither is answered by re-quoting the line.

test('a tweak is not answered by re-quoting the line she just amended', () => {
  const state = toProtocol();
  let t = applyRewireW3Turn(state, [], 'Walk the block', { text: 'A real redirect.' });
  assert.match(t.reply, /I won't know what I'm capable of until I try/, 'offered first, as before');

  // HER MESSAGE, VERBATIM FROM THE GATE. My first draft paraphrased it and the paraphrase missed the tweak
  // branch entirely — so the test failed against correct code, and the real finding is below.
  t = applyRewireW3Turn(t.state, [],
    "That one's close but it's not quite right anymore — I had a kitchen, I just don't have a restaurant. "
    + "The kitchen's still mine. Something more like: \"I still know how to feed myself, not just everyone else.\"",
    { text: '' });
  assert.doesNotMatch(t.reply, /I won't know what I'm capable of until I try/,
    'the amended line was quoted straight back at her');
  assert.match(t.reply, /exact words|how you'd say it/i, 'and she is asked for her own wording');
});

test('the two corrections stay distinguishable — a tweak must not apologise', () => {
  // A dispute means we put words in her mouth and we own it. A tweak means her own line has stopped fitting, and
  // apologising there would be the Companion taking blame for her change of mind — false, and faintly grovelling.
  const state = toProtocol();
  let t = applyRewireW3Turn(state, [], 'Walk the block', { text: 'A real redirect.' });
  const tweak = applyRewireW3Turn(t.state, [], 'Yes, but say it shorter.', { text: '' }).reply;
  assert.doesNotMatch(tweak, /wasn't your line|put it in your mouth/i, 'a tweak must not apologise');

  const dispute = applyRewireW3Turn(t.state, [], "I never wrote that.", { text: '' }).reply;
  assert.match(dispute, /wasn't your line/i, 'a dispute must');
});

// A SECOND KNOWN GAP, found by the paraphrase that failed above and worth more than the test that found it.
//
// A long reply that does NOT trip the tweak matcher falls through to `resolveReframe`, which stores the WHOLE
// message as her true line. The paraphrase produced exactly that:
//
//   stored: "That's close but not quite right anymore. Something more like: \"I still know how to feed myself.\""
//
// Her reasoning, her correction and her actual line, committed as one string — and this is the keeper handed back
// to her on her worst day, and stamped into the False Start Protocol she keeps.
//
// NOT FIXED HERE, and the reason is the same one written at w3ReframeTweak: pulling the real line out of a
// sentence that also contains the reasoning is extraction, and doing it at speed on this beat is how a paragraph
// becomes her principle. It needs the propose→confirm shape the Reclaim List already uses — she rules on it —
// rather than a smarter regex. [[reclaim-capture-discipline-decision-ii]]
test.skip('KNOWN GAP — a long correction is stored whole as her true line', () => {
  const state = toProtocol();
  let t = applyRewireW3Turn(state, [], 'Walk the block', { text: 'A real redirect.' });
  t = applyRewireW3Turn(t.state, [],
    'That\'s close but not quite right anymore. Something more like: "I still know how to feed myself."', { text: '' });
  const stored = (t.state.collected as { w3Reframe?: string }).w3Reframe ?? '';
  assert.ok(stored.length < 60, `a paragraph was committed as her true line: ${JSON.stringify(stored)}`);
});
