import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idqOpening, idqRespond, parseLikert, type IdqConvState } from '../lib/agent/idq-conversation.ts';

test('opening presents the intro, Physical framing, and item 1 with anchors', () => {
  const t = idqOpening();
  assert.match(t.reply, /24 short statements/);
  assert.match(t.reply, /about your Physical/);
  assert.match(t.reply, /^.*1\. /ms);
  assert.match(t.reply, /1 = not at all like me/);
  assert.equal(t.state.responses.length, 0);
});

test('parseLikert handles digits and natural phrases', () => {
  assert.equal(parseLikert('4'), 4);
  assert.equal(parseLikert('honestly, a 2 most days'), 2);
  assert.equal(parseLikert('very much so'), 5);
  assert.equal(parseLikert('not at all'), 1);
  assert.equal(parseLikert('sometimes'), 3);
  assert.equal(parseLikert('hard to say'), null);
});

test('an unparseable answer re-prompts the same item without advancing', () => {
  const s: IdqConvState = { responses: [3, 3] };
  const t = idqRespond(s, 'umm what do you mean');
  assert.equal(t.state.responses.length, 2); // unchanged
  assert.match(t.reply, /number from 1 to 5/i);
  assert.match(t.reply, /3\. /); // re-presents item 3 (index 2)
});

test('crisis disclosure mid-IDQ halts and routes to 988', () => {
  const s: IdqConvState = { responses: [3] };
  const t = idqRespond(s, 'i honestly want to die');
  assert.equal(t.crisis, true);
  assert.match(t.reply, /988/);
  assert.equal(t.state.responses.length, 1); // unchanged
});

test('shows a dimension transition header at the boundary', () => {
  const s: IdqConvState = { responses: [3, 3, 3, 3, 3] }; // 5 answered; next answer completes Physical
  const t = idqRespond(s, '3');
  assert.equal(t.state.responses.length, 6);
  assert.match(t.reply, /about your Self/); // now framing the Self dimension
});

test('answering all 24 completes with a 24-length response set', () => {
  let s = idqOpening().state;
  let last;
  for (let i = 0; i < 24; i++) last = idqRespond(s, '3'), (s = last.state);
  assert.equal(last!.complete, true);
  assert.equal(last!.responses?.length, 24);
  assert.ok(last!.responses!.every((r) => r === 3));
});
