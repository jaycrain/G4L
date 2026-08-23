import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn, parseReclaimListSubmission } from '../lib/agent/onboarding-staged.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

// The Reclaim List is captured with a STRUCTURED builder, not extracted from conversation (Jay, 2026-07-29 — after
// conversational extraction proved ~30% lossy across walks). Capture is 100% reliable by construction: the member's
// exact entries ARE the list. These fixtures lock that — the submission is stored verbatim and the machine advances.

test('parseReclaimListSubmission — a bulleted/numbered block splits into the member\'s exact items', () => {
  assert.deepEqual(parseReclaimListSubmission('• Run a 5k\n• Sleep well\n• See my friends'), ['Run a 5k', 'Sleep well', 'See my friends']);
  assert.deepEqual(parseReclaimListSubmission('1. Ride again\n2. Coach a friend'), ['Ride again', 'Coach a friend']);
  assert.deepEqual(parseReclaimListSubmission('Just one thing'), ['Just one thing']);
  assert.deepEqual(parseReclaimListSubmission('   '), []);
});

test('structured reclaim — the submission is stored VERBATIM and advances to the Grinta baseline', () => {
  const atReclaim: ConvState = {
    stage: 'reclaim',
    collected: { athleticPast: 'a runner', identityNoun: 'Runner', gap: 'The years quietly took it, one reasonable choice at a time.' },
  };
  const t = applyStagedTurn(atReclaim, [], '• Join a softball team\n• Lose 30 lbs\n• Sleep through the night', { text: '' });
  assert.deepEqual(
    t.state.collected.reclaimList,
    ['Join a softball team', 'Lose 30 lbs', 'Sleep through the night'],
    'the member’s exact entries — nothing paraphrased, nothing dropped',
  );
  // THE RECAP RIDES ON THE HANDOFF — one turn (2026-08-23). It briefly held the stage for an evidence question;
  // that question is cut because W2's Visioning already builds an ordinary-day picture off this very list.
  assert.equal(t.state.stage, 'grinta', 'the submission hands into the Grinta baseline in one turn');
  assert.match(t.reply, /here's what you wrote/i, 'the read-back is deterministic, not the model\'s job');
  assert.match(t.reply, /harder thing to write down/i, 'the recap recognises the act');
  assert.match(t.reply, /starting point, not a contract/i, 'and sets the expectation that this gets sharpened');
  assert.doesNotMatch(t.reply, /on an ordinary week/i, 'the evidence question is gone — W2 owns that beat');
});

test('structured reclaim — items volunteered earlier are kept; the submission adds to them, deduped', () => {
  const atReclaim: ConvState = {
    stage: 'reclaim',
    collected: { athleticPast: 'a cyclist', identityNoun: 'Cyclist', gap: 'It faded.', reclaimList: ['Ride again'] },
  };
  const t = applyStagedTurn(atReclaim, [], '• Ride again\n• Lose 20 lbs', { text: '' });
  assert.deepEqual(t.state.collected.reclaimList, ['Ride again', 'Lose 20 lbs'], 'the pre-existing want is not duplicated');
});

test('the model cannot append to her list — there is no turn left for it to try', () => {
  // FOUND BY TESTING IT, NOT BY READING IT (2026-08-22), and then closed STRUCTURALLY the next morning. While the
  // recap held the stage for an answer, the model got a turn after the builder had committed and the record merge
  // appended a phantom want as a fourth item. I guarded it by restoring her committed list; cutting the evidence
  // question removed the turn entirely, so there is nothing left to guard. The property is pinned either way.
  const at: ConvState = { stage: 'reclaim', collected: { identityNoun: 'Maker', gap: 'the job went', doors: ['career_cliff'] } };
  // The model tries a phantom on the SUBMITTING turn — the only turn it still has here.
  const submitted = applyStagedTurn(at, [], '• A creative job\n• Lose 20 lbs\n• Peace at home',
    { text: '', record: { reclaimList: ['PHANTOM WANT'] } });
  assert.deepEqual(submitted.state.collected.reclaimList, ['A creative job', 'Lose 20 lbs', 'Peace at home'],
    'the submission is authoritative — the model adds nothing');

  assert.equal(submitted.state.stage, 'grinta', 'no turn sits between her submission and the survey');
});

test('neither the frame nor the recap names her Identity in the third person', () => {
  // CLAUDE.md: the Companion addresses the member as "you" — the Identity may be named at the moment she CLAIMS
  // it and at a real milestone, nowhere else. Both halves of this stage got it wrong on the day they were
  // written: the frame said "What did the Maker DO?" (caught by the naming guard) and the recap said "what would
  // the Maker be doing" two beats later (caught by reading the trace, because no guard covers that turn).
  const at: ConvState = { stage: 'gap', awaitingConfirm: true,
    collected: { identityNoun: 'Maker', doors: ['career_cliff'], gap: 'the job went' } };
  const frame = applyStagedTurn(at, [], "That's the whole of it.", { text: '', replyIntent: 'done' });
  assert.doesNotMatch(frame.reply, /the Maker/, 'the frame never names her Identity');

  const recap = applyStagedTurn(frame.state, [], '• A creative job\n• Lose 20 lbs\n• Peace at home', { text: '' });
  assert.doesNotMatch(recap.reply, /the Maker/, 'and neither does the recap');
});

// DONNA'S TRIPLE READ-BACK, 2026-08-23. "Worked well, straightforward with no hiccups, but did repeat the list so
// it's showing 3 times. What I typed in, then it reiterated it 2x after that."
//
// Her list appeared as her own submission, then in the recap's read-back, then a THIRD time because the model was
// still handed a turn and used it to reflect the list back.
//
// THE DUPLICATION WAS THE REPORTED BUG; THE SAME BUBBLE CARRIED TWO WORSE ONES. It said "the first goes straight
// back to the Maker" — the member in the third person by her Identity, the exact rule we spent 8/22 enforcing in
// engine copy. And "that's a clear, honest list" appraises her ANSWER, which is a verdict rather than a receipt.
// Three defects, one cause: the model got a turn where it has no job.
//
// The model text below is hers verbatim from that walk, so this fails the way she saw it.
test('structured reclaim — the model is SILENT on the recap turn (list read back once, no Identity, no verdict)', () => {
  const at: ConvState = { stage: 'reclaim', collected: { identityNoun: 'Maker', gap: 'the job went', doors: ['career_cliff'] } };
  const t = applyStagedTurn(at, [], '• A creative job that pays the bills\n• Lose 20 lbs\n• Peace at home', {
    text: "That's a clear, honest list. Let me reflect it back: - A creative job - Lose 20 lbs - Peace at home. "
      + 'Each of those is worth wanting. The first goes straight back to the Maker — the room where you were most yourself.',
  });

  const reply = t.reply;
  // ONE read-back. Counting an item's occurrences is the assertion because that is precisely what she counted.
  assert.equal(reply.split('Lose 20 lbs').length - 1, 1, 'her list is read back exactly once, not twice');
  assert.match(reply, /Here's what you wrote/, 'the engine recap is what does the reading back');

  // The model's whole turn is dropped — so neither of the rule breaks it carried can reach her.
  assert.doesNotMatch(reply, /Maker/, 'her Identity is never spoken in the third person');
  assert.doesNotMatch(reply, /clear, honest list/, 'her answer is never appraised');
});
