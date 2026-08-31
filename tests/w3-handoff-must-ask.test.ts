import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// DONNA, 2026-08-30, on the False Start Protocol: "my Redirect wasn't explicitly called out like it had been
// previously. So, when we were populating that, isn't something I really would choose for here. It picked up a
// response I gave to a question around what happens in my body when I experience conflict."
//
// THE SHAPE. The handoff into `protocol` used the model's turn INSTEAD of the scripted ask whenever the model said
// anything: `${INTRO}${SEP}${reply || W3_REDIRECT}`. When its turn reflected and stopped, she landed in a stage
// that WAITS for her Redirect with nothing having asked for one — and `idx === 0` stores whatever arrives. Her
// answer to an earlier question became a move in her weekly tracker that she never chose.
//
// W1's fifth domain got this exact fix on 2026-08-27, with a comment that states the rule: "Any beat that advances
// the member into a stage expecting their answer has to end asking for it." It was never applied here.
// [[one-fact-many-sites]]

const SRC = readFileSync(new URL('../lib/agent/rewire.ts', import.meta.url), 'utf8');

test('the protocol handoff APPENDS the Redirect ask — it never substitutes the model for it', () => {
  const handoff = /b\.stage = 'protocol';[\s\S]{0,1400}?b\.reply = ([^\n]+)/.exec(SRC)?.[1] ?? '';
  assert.ok(handoff, 'the protocol handoff must still be findable');
  assert.ok(!/\$\{reply \|\| W3_REDIRECT\}/.test(handoff),
    'reply-OR-ask is the bug: a model turn that does not ask leaves her asked for nothing');
  assert.match(handoff, /withScriptedBeat\(reply, W3_REDIRECT\)/,
    "the model's reflection is kept AND the ask appended, exactly as W1 does");
});

test('EVERY handoff into a waiting stage carries its own ask', () => {
  // The generalisable half. A stage that stores whatever arrives must be entered by a turn that asked for it —
  // otherwise the member's previous thought becomes her answer. Scans the two known waiting-stage entries.
  for (const stage of ['protocol', 'affirm']) {
    const re = new RegExp(`b\\.stage = '${stage}';[\\s\\S]{0,1600}?b\\.reply = ([^\\n]+)`);
    const handoff = re.exec(SRC)?.[1] ?? '';
    assert.ok(handoff, `${stage}'s handoff must be findable`);
    assert.match(handoff, /withScriptedBeat|W1_TURN_ASK_FALLBACK|W3_REDIRECT/,
      `${stage} is entered by a turn that asks — she is never asked for something silently`);
  }
});
