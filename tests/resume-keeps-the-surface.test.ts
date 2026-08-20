// A REFRESH MUST NOT TURN A TAP-ONLY BEAT INTO A TEXT BOX.
//
// Donna, mid-walk 2026-08-20, on the Grinta baseline: twelve items that can ONLY be answered 1-5, and no 1-5 to
// tap — just "Type your reply…". She had refreshed, at my suggestion, to pick up a deploy.
//
// The saved session carries `state` and `messages` and never carried the expectation, and the resume path never
// set it. So it was live at EVERY structured beat, not only that one: refresh at the gap confirm and the three
// chips are gone; refresh at the Reclaim builder and the form is. Anywhere the product says tap, a reload said
// type. That it surfaced on the Grinta survey is luck — it is the beat where a text box is most obviously wrong.
//
// The expectation is DERIVED from the persisted state rather than stored beside it, so a resumed surface cannot
// disagree with what the live turn produced, and sessions saved before the fix resume correctly too. These tests
// hold that equivalence rather than a list of expected kinds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn, expectsForResume } from '../lib/agent/onboarding-staged.ts';
import type { ConvMessage, ConvState, ModelTurn, Turn } from '../lib/agent/onboarding.ts';

/** The client ⇄ server-action boundary: whatever survives is exactly what a resume gets. */
const roundtrip = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function walk(steps: [string, ModelTurn][], from: ConvState): { last: Turn; state: ConvState } {
  let state = from;
  const history: ConvMessage[] = [];
  let last!: Turn;
  for (const [msg, mt] of steps) {
    last = applyStagedTurn(state, history, msg, mt);
    history.push({ role: 'member', text: msg }, { role: 'agent', text: last.reply });
    state = last.state;
  }
  return { last, state };
}

const atReclaim = (): ConvState => ({
  stage: 'reclaim',
  collected: { identityNoun: 'Maker', gap: 'The job went, then the partnership, then my father nearly died.' },
});

test('THE ONE SHE HIT — the Grinta scale survives a refresh', () => {
  const { last, state } = walk([
    ['I want to be making things again.', { text: 'ok', record: { reclaimList: ['making things again'] } }],
    ["That's the lot.", { text: 'ok', replyIntent: 'done' }],
    ['• making things again\n• sleep\n• see people', { text: '' }],
  ], atReclaim());
  assert.equal(last.expects?.kind, 'scale', 'the live turn offers the scale');
  const resumed = expectsForResume(roundtrip(state));
  assert.deepEqual(resumed, last.expects, 'and a refresh offers exactly the same thing');
  assert.equal(resumed?.index, 1, 'including WHICH item she is on — resuming onto the wrong one is its own bug');
});

test('the Reclaim builder survives a refresh, still holding what she said', () => {
  const { last, state } = walk([
    ['I want to be making things again.', { text: 'ok', record: { reclaimList: ['making things again'] } }],
    ["That's the lot.", { text: 'ok', replyIntent: 'done' }],
  ], atReclaim());
  assert.equal(last.expects?.kind, 'reclaim_list');
  const resumed = expectsForResume(roundtrip(state));
  assert.deepEqual(resumed, last.expects, 'a refresh must not drop her back to a text box mid-list');
  assert.deepEqual(
    (resumed as { seeded?: string[] }).seeded,
    ['making things again'],
    'and it still opens holding what she already said — losing that is losing her words',
  );
});

test('the gap confirm survives a refresh, with the Doors it had named', () => {
  const atConfirm: ConvState = {
    stage: 'gap',
    awaitingConfirm: true,
    // PROPOSED, not confirmed. This beat is where she RULES on the Doors, so a refresh mid-gate must bring back
    // the pending set; seeding `doors` here would be seeding the answer she has not given yet.
    collected: { identityNoun: 'Maker', gap: 'A decade of it.', doorsProposed: ['career_cliff', 'aging_parents'] },
  };
  const resumed = expectsForResume(roundtrip(atConfirm));
  assert.equal(resumed?.kind, 'gap_confirm', 'the three chips come back');
  assert.equal((resumed as { doorsHeard?: unknown[] }).doorsHeard?.length, 2, 'and so do the Doors she can take off');
});

test('a CONVERSATIONAL beat resumes with no surface — the text box is correct there', () => {
  // The fix must not start rendering chips where she is meant to talk.
  const midGap: ConvState = { stage: 'gap', collected: { identityNoun: 'Maker' } };
  assert.equal(expectsForResume(roundtrip(midGap)), undefined);
});

test('a finished session resumes with no surface', () => {
  assert.equal(expectsForResume({ stage: 'complete', collected: {} } as ConvState), undefined);
});
