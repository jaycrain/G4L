// ── RETIRED 2026-08-22 — the draw-out this file exists to prove is gone ─────────────────────────────────────────
//
// These tests pinned "conversation elicits, structure confirms": up to six turns of the Companion drawing wants
// out of her, then a builder that opened ALREADY HOLDING them so she never typed the same thing twice.
//
// That seeding is what carried Donna's conversational turns into her committed Reclaim List — including a bug
// report ABOUT the Reclaim List, stored as something she wanted back. Jay's replacement (widget-first,
// docs/decisions/2026-08-22-reclaim-list-widget-first.md) removes the conversation entirely: frame, builder,
// recap. Nothing but her typing reaches the list.
//
// KEPT AS SKIPPED, not deleted. The draw-out was not a bad idea badly built — it was a good idea whose failure
// mode took three weeks to see, and these tests are the record of what it got RIGHT (verbatim capture, no
// re-tagging, the cap that stopped a "what else?" march). If a conversational elicitation is ever reintroduced
// in front of the builder, it has to clear these again — and it must not seed.
// THE RECLAIM LIST: conversation elicits, structure confirms.
//
// WHY THIS CHANGED. The builder replaced conversational capture on 2026-07-29 after "~30% of items dropped". That
// number is real but it has been mis-cited — including by me, three times. The source (docs/handoffs/
// 2026-07-29-stabilization-learnings.md) records it as one row in a table of four bugs with ONE root cause: "the
// member said X, the model drilled + re-tagged, ~30% of items dropped". The loss was never inherent to
// conversation. It was the model overwriting what she plainly said — the same failure as every other row, and the
// row directly beneath it is the gap-confirm bug we just replaced with chips.
//
// Both causes are now gone: the drill-and-sharpen steering was deleted (2026-08-19), verbatim capture is the rule,
// and "her plain words outrank the model's inference" is enforced at the choke points.
//
// So the beat can be what it should have been: the Companion draws her out, and the builder opens ALREADY HOLDING
// what she said. She never types it twice, and the structure confirms rather than asks. Opening the builder cold
// was structure doing the eliciting — the one thing the principle forbids, and the beat Donna twice called rushed.
//
// The failure this must not reintroduce: a want she names being dropped, re-worded, or asked for a second time.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import type { ConvState, ConvMessage, ModelTurn } from '../lib/agent/onboarding.ts';

const atReclaim = (): ConvState => ({
  stage: 'reclaim',
  collected: { athleticPast: 'Making things', identityNoun: 'Maker', gap: 'The job went, then the partnership, then my father nearly died.' },
});

function walk(steps: [string, ModelTurn][], from: ConvState = atReclaim()) {
  let state = from;
  const history: ConvMessage[] = [];
  const turns = [];
  for (const [m, mt] of steps) {
    const t = applyStagedTurn(state, history, m, mt);
    history.push({ role: 'member', text: m }, { role: 'agent', text: t.reply });
    state = t.state;
    turns.push(t);
  }
  return { state, turns, last: turns[turns.length - 1]! };
}

test.skip('the builder does NOT open cold — the Companion draws her out first', () => {
  const { last } = walk([['Okay.', { text: 'What do you want back?' }]]);
  assert.notEqual(last.expects?.kind, 'reclaim_list', 'a form arriving before she has said anything is the rush');
});

test.skip('what she names in the draw-out is KEPT, verbatim, as she says it', () => {
  const { state } = walk([
    ['I want to be making things again.', { text: 'Making things.', record: { reclaimList: ['making things again'] } }],
    ['And I want to stop dreading Mondays.', { text: 'Mondays.', record: { reclaimList: ['stop dreading Mondays'] } }],
  ]);
  assert.deepEqual(state.collected.reclaimList, ['making things again', 'stop dreading Mondays']);
});

test.skip('when she is done, the builder opens ALREADY HOLDING what she said', () => {
  const { last } = walk([
    ['I want to be making things again.', { text: 'Making things.', record: { reclaimList: ['making things again'] } }],
    ['And to stop dreading Mondays.', { text: 'Mondays.', record: { reclaimList: ['stop dreading Mondays'] } }],
    ["That's the lot.", { text: 'Understood.', replyIntent: 'done' }],
  ]);
  assert.equal(last.expects?.kind, 'reclaim_list', 'the structure arrives to CONFIRM, once she has spoken');
  assert.deepEqual(
    (last.expects as { seeded: string[] }).seeded,
    ['making things again', 'stop dreading Mondays'],
    'she must never type the same thing twice',
  );
});

test.skip('the builder submission still wins — her exact entries ARE the list', () => {
  // The draw-out seeds; the submission is authoritative. Editing a seeded line in the builder must stick.
  const { state } = walk([
    ['I want to be making things again.', { text: 'ok', record: { reclaimList: ['making things again'] } }],
    ["That's it.", { text: 'ok', replyIntent: 'done' }],
    ['• making things again, properly\n• sleep\n• see people', { text: '' }],
  ]);
  assert.deepEqual(state.collected.reclaimList, ['making things again, properly', 'sleep', 'see people']);
});

test.skip('she is never trapped in the draw-out — a member who wants the list gets it', () => {
  const { last } = walk([['Can I just write them down?', { text: 'Of course.', replyIntent: 'done' }]]);
  assert.equal(last.expects?.kind, 'reclaim_list', 'asking for the form must produce the form');
});

test.skip('the draw-out is BOUNDED — it can never become an interrogation', () => {
  // A member who keeps giving must still reach the builder. The cap is the same idea as the gap's, and it is what
  // stops "what else?" becoming the march that produced the rushed reports from the other direction.
  const many: [string, ModelTurn][] = Array.from({ length: 12 }, (_, i) => [
    `I want thing ${i}.`,
    { text: 'ok', record: { reclaimList: [`thing ${i}`] } } as ModelTurn,
  ]);
  const { turns } = walk(many);
  assert.ok(turns.some((t) => t.expects?.kind === 'reclaim_list'), 'the builder must arrive without her asking');
});
