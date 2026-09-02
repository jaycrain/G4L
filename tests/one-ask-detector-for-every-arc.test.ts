// EVERY ARC USES THE SAME ASK-DETECTOR, because Reconnect used to have its own and it was two generations behind.
//
// Donna's Excavation, 2026-09-01. The Companion said:
//
//   "…standing where they stood, when you'd run it. Tell me what that day was actually like — walk me through it."
//   "Stay with that a moment — what did it actually cost you, the part you maybe stopped counting?"
//
// Two asks. She answered: "I'll take the first one." It happened four more times, including inside the turn where
// the Companion apologised for doing it.
//
// The cause was not the rule — the rule was right and had been fixed. It was that lib/agent/reconnect.ts carried
// a PRIVATE copy of withQuestion, and the copy had missed two rounds of fixes to the original:
//
//   · it tested `/\?\s*$/` plus a 60-character trailing window. A question followed by a long coda pushes the '?'
//     out of that window, so the engine appended a second one. The kernel replaced that heuristic with a
//     paragraph-scoped check after two of Jay's walks hit it; the fix never crossed the file boundary.
//   · it had no notion of an imperative ask. "Tell me the rest." is an ask with no question mark.
//
// The local copy is deleted and Reconnect imports the kernel's. This test exists so a third copy cannot quietly
// appear: it asserts the BEHAVIOUR on the real transcript lines, and that no arc file re-declares the function.
//
// WHY IT IS WORTH A TEST AND NOT JUST A DELETE. This is the fourth "one fact, two sites" defect in three days —
// the chip names, the tap readers, the prompt-rule guard, and now this. Every one was a rule that existed, was
// correct, and did not run everywhere it was needed. The deletion fixes today; the test is what makes it stay
// fixed. [[one-fact-many-sites]]

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { withQuestion } from '../lib/agent/onboarding-staged.ts';

const PROBE = 'Stay with that a moment — what did it actually cost you?';

test('an imperative ask holds the engine probe — the line Donna answered "I\'ll take the first one" to', () => {
  const modelTurn =
    "So it wasn't only losing the place — it was finding out you were on the outside of it. " +
    'Tell me what that day was actually like — walk me through it.';
  assert.equal(withQuestion(modelTurn, PROBE), modelTurn, 'the model already asked; ours must not be added');
});

test('a question with a long coda holds it too — the char-window shape that predates her walk', () => {
  // The '?' sits more than 60 characters from the end, which is exactly what the retired heuristic could not see.
  const modelTurn =
    'What did that day actually cost you? Take it wherever it starts, and give me as much of it as you can ' +
    'manage — the ordinary details are the ones that turn out to matter most.';
  assert.equal(withQuestion(modelTurn, PROBE), modelTurn);
});

test('a pure reflection STILL gets a probe — the fix must not leave a member with nothing to answer', () => {
  // The failure worse than stacking. If suppression over-fires the member gets a turn with no question at all,
  // and the correction card that used to catch that is confirm-only now.
  const reflection = 'You gave a dead kitchen a clean handover, because that is who you are.';
  assert.ok(withQuestion(reflection, PROBE).includes(PROBE), 'a reflection with no ask must still be asked');
});

test('no arc file declares its own withQuestion — the copy is how Reconnect fell behind', () => {
  const files = readdirSync('lib/agent').filter((f) => f.endsWith('.ts'));
  const offenders = files.filter((f) => {
    if (f === 'onboarding-staged.ts') return false; // the one definition
    const src = readFileSync(`lib/agent/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    return /function\s+withQuestion\s*\(/.test(src);
  });
  assert.deepEqual(offenders, [],
    'import withQuestion from the kernel; a private copy is how this diverged for two rounds of fixes');
});

// ── THE MODEL MUST NOT RANGE ACROSS DOORS IT HAS NOT WALKED ──────────────────────────────────────────────────
//
// Marie's Excavation, 2026-09-02. At the SECOND Door's confirm the Companion delivered a synthesis across all
// four — "All four of these doors — the restaurant, the not-noticing, your mother, the load — they keep circling
// the same thing" — naming the load before Load-Bearer had been opened. The engine then opened it on schedule,
// correctly, and she answered:
//
//   "You already asked me that. We just did The Load-Bearer — I answered it, you reflected it back, and I
//    confirmed it. We're done with that door."
//
// Donna hit the same shape the day before: "it doubled back when we were already done."
//
// THE ENGINE IS NOT AT FAULT and was deliberately left alone. It opened four Doors for four Doors, in order. The
// model got ahead of it, because its context lists the whole marked set and nothing told it to stay on the one in
// front of it. So the fix is an instruction, not prose-detection of the model's stage — that was tried, shipped,
// and REVERTED on 2026-08-2x for telling a member her own protest was a goal. Do not rebuild it.
//
// This asserts the instruction REACHES the model. A rule the model never receives is a rule that does not exist,
// which is the same reason companion-purpose.test.ts exists. [[test-the-seam-not-the-halves]]
import { stageInstructionReconnect } from '../lib/agent/reconnect.ts';

test('the Doors stage tells the model to stay on the Door in front of it', () => {
  const doors = stageInstructionReconnect('doors', {} as never);
  assert.match(doors, /ONE DOOR AT A TIME/, 'the constraint must be in the stage instruction the model receives');
  assert.match(doors, /have not been opened yet/, 'and must say what specifically not to do');
});

test('it carries the member’s own words as the exemplar, not an abstract rule', () => {
  // A rule written without its example gets implemented as a vague preference. Hers is the clearest statement of
  // the harm anyone has produced, and it costs nothing to keep it in front of the model.
  const doors = stageInstructionReconnect('doors', {} as never);
  assert.match(doors, /We just did The Load-Bearer/, 'the exemplar belongs with the rule');
});

test('the constraint is scoped to the Doors stage — it must not leak into the others', () => {
  for (const stage of ['drift', 'window', 'legacy'] as const) {
    assert.doesNotMatch(stageInstructionReconnect(stage, {} as never), /ONE DOOR AT A TIME/,
      `${stage} has no Doors queue; the rule would be noise there`);
  }
});
