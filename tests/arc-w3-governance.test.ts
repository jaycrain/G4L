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
