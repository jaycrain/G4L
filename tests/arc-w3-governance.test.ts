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
  assert.match(t.reply, /wasn't your line|your words/i, 'the Companion owns the error and re-offers');

  // now a real bad-day line → advances PAST Reframe to Restart (idx 2 — not skipped to the close), harvests HER line.
  t = applyRewireW3Turn(t.state, [], 'A slip is the toll for changing, not proof I stop', { text: 'That has teeth — go back to your picture.' });
  assert.equal((t.state.stageScratch?.protocol as { moveIdx?: number } | undefined)?.moveIdx, 2, 'advanced to Restart (idx 2), Restart not skipped');
  assert.equal(t.complete, false, 'not complete yet — Restart still comes before the close');
  assert.ok((t.state.pendingHarvest ?? []).some((h) => /toll for changing/.test(h.payloadRef)), 'HER real line is the one harvested, never the dispute');
});
