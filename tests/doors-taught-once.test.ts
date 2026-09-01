// THE DOORS TEACHING IS OWED ONCE — and the guard that said so had never run.
//
// Jay's walk, 2026-08-28. On one screen the Companion said this, in full:
//
//   "Somewhere, the distance between you and who you used to be started to open. Sometimes it's one clear thing
//    — a loss, a diagnosis, a move, a job that swallowed you. More often it's slower: an accumulation of what we
//    call Doors — moments and seasons you walk through and barely notice, each one widening the gap. What's been
//    happening that caused that version of you to Fade? Tell me how it went for you."
//
// …and then said the identical 70 words again, immediately after he answered it. His words: "Members aren't
// going to have this patience."
//
// gapOpen ALREADY had the ladder to prevent exactly this — full teaching on the first ask, a short re-ask on the
// second, a shorter one after that. It read its `history` parameter to decide. That parameter was declared
// `history: ConvMessage[] = []` and not one of the nine call sites passed it, so `asked` was always 0 and the
// full paragraph was the only branch that could ever be reached.
//
// This is the defect class this codebase keeps paying for: A RULE THAT EXISTS AND DOES NOT RUN. The voice gate
// that checked only model output, the Rewire handoff guard wired to four of five domains, the identity breathe
// floor unreachable past tap-to-pick, the CTA reserve that never reached mobile. Written, correct, unreachable.
// A default parameter value is one of the quietest ways to build one: nothing is missing, nothing errors, and
// the guard simply never sees a reason to fire.
//
// So this test does not check the ladder's wording. It drives the real engine and asserts the member never gets
// the teaching twice — the thing Jay actually saw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import { checkRepeatedReplies } from '../lib/agent/capture-invariants.ts';
import type { ConvState, ConvMessage } from '../lib/agent/onboarding.ts';

const SRC = readFileSync(new URL('../lib/agent/onboarding-staged.ts', import.meta.url), 'utf8');
/**
 * CODE ONLY — comments stripped.
 *
 * Any assertion that something is ABSENT must run against this, never against the raw source. A fix worth making
 * is usually worth explaining, the explanation names the thing it replaced, and then the guard fires on the
 * sentence describing the bug it just prevented. That has now happened three times in one sitting (twice in the
 * front-door CSS guards, once here), which is enough to stop treating it as a slip and give it a name.
 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

// The distinctive clause of the teaching. Matching on this rather than the whole paragraph so a copy edit
// doesn't silently disable the test — the phrase is the terminology introduction, which is the thing owed once.
const TEACHING = /an accumulation of what we call Doors/gi;

test('the Doors teaching is delivered once, however many times the gap is re-opened', () => {
  // A member in the gap stage who keeps giving thin answers — the shape that re-enters gapOpen turn after turn,
  // and the shape Jay hit: he answered, and the engine asked again from scratch.
  let state: ConvState = { stage: 'gap', collected: { identityNoun: 'Rider' } };
  const history: ConvMessage[] = [];
  const replies: string[] = [];

  for (const message of ['I guess so', 'not sure', 'hard to say', 'maybe work', 'yeah']) {
    const turn = applyStagedTurn(state, history, message, { text: '' });
    state = turn.state as ConvState;
    replies.push(turn.reply);
    // The live loop appends BOTH sides before the next turn. Getting this wrong is what the bug was, so the
    // test has to model it faithfully or it proves nothing.
    history.push({ role: 'member', text: message }, { role: 'agent', text: turn.reply });
  }

  const taught = replies.join('\n').match(TEACHING)?.length ?? 0;
  assert.ok(taught <= 1, `the Doors teaching was delivered ${taught} times across ${replies.length} turns`);
});

test('no agent reply repeats verbatim across a gap walk', () => {
  // The same walk, judged by the invariant the project already owns. checkRepeatedReplies has existed for
  // months, catches this exactly, and runs ONLY in tests — it has never seen a live turn. Pointing it at the
  // real engine here is the cheapest way to make it mean something.
  let state: ConvState = { stage: 'gap', collected: { identityNoun: 'Rider' } };
  const history: ConvMessage[] = [];
  const transcript: { role: 'agent' | 'member'; text: string }[] = [];

  for (const message of ['I guess so', 'not sure', 'hard to say', 'maybe work']) {
    const turn = applyStagedTurn(state, history, message, { text: '' });
    state = turn.state as ConvState;
    transcript.push({ role: 'member', text: message }, { role: 'agent', text: turn.reply });
    history.push({ role: 'member', text: message }, { role: 'agent', text: turn.reply });
  }

  const violations = checkRepeatedReplies(transcript);
  assert.deepEqual(violations, [], violations.map((v) => v.detail).join('\n'));
});

test('the gap openers cannot be called without the history they judge on', () => {
  // THE STRUCTURAL HALF. Threading the argument through nine call sites fixes today; a required parameter is
  // what stops the tenth call site from re-introducing it, because the compiler refuses instead of defaulting
  // to a value that reads as "nothing was said yet".
  //
  // Written as a source assertion because the functions are module-private, and making them public purely to
  // be testable would be a worse trade than reading the signature.
  assert.doesNotMatch(CODE, /function gapOpen\([^)]*=\s*\[\]/,
    'a default history means "nothing has been said yet" — which is never true after the first turn');
  assert.doesNotMatch(CODE, /function gapBridge\([^)]*=\s*\[\]/, 'the bridge teaches Doors too, so it owes the same');
  assert.match(CODE, /function gapOpen\(c: Collected, history: ConvMessage\[\]\)/, 'history stays required');
});

// ── THE IDENTITY CHIPS ARRIVE WITH THEIR FRAME ────────────────────────────────────────────────────────────────
//
// Jay, same walk: "Identity suggestions came to abruptly too."
//
// IDENTITY_PICK_OFFER — "Here are a few words for who that was — tap the one that fits, or write your own…" —
// is the sentence that tells a member what the chips are and that they may coin their own. It was wired as
// `b.modelText || IDENTITY_PICK_OFFER`, so it showed ONLY when the model returned nothing at all. In every real
// turn the model says something, so the chips rendered under an unrelated reflection with no frame.
//
// A third instance, in one sitting, of authored copy that exists and cannot be reached.
test('the chips are always introduced — the frame is not a fallback for a silent model', () => {
  assert.doesNotMatch(CODE, /b\.modelText \|\| IDENTITY_PICK_OFFER/,
    'as a fallback, the frame only ever shows when the model is silent — which is never');
  // MATCHES THE PROPERTY, NOT THE LITERAL CALL (loosened 2026-09-01). This pinned the exact expression
  // `receiveThen(b.modelText, IDENTITY_PICK_OFFER)`, so wrapping the first argument broke it — even though the
  // thing it guards was untouched. The frame is still unconditional, still the opener, still built from the
  // model's text; the wrapper only strips the model's own duplicate of the invite (dropPickInvite, added after
  // Marion's walk served both). An assertion that fails on a change it was never about teaches you to edit the
  // test to make it quiet, which is how a real guard gets deleted one day.
  //
  // What is still nailed down: the offer reaches receiveThen as the OPENER (never a fallback — see above), and
  // the receipt is derived from b.modelText rather than replaced by something else.
  assert.match(CODE, /receiveThen\([^;]*\bb\.modelText\b[^;]*,\s*IDENTITY_PICK_OFFER\)/,
    "model keeps the reflection, engine keeps the frame — this file's own pattern for the seam");
});

test('a handle is not offered off one thin line', () => {
  // The floor Jay asked for twice, in his words: "a couple more turns".
  assert.match(CODE, /const drawnOut = \(s\.identityTurns \?\? 0\) >= 2/, 'the breathe floor is two turns');
});
