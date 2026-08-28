// THE THREE CAPTURE-LOOP FIXES FROM JAY'S 2026-08-27 WALK, replayed offline.
//
// All three touch the live onboarding loop, which is the surface CLAUDE.md tells us to default to NOT touching.
// So each one is pinned here through applyStagedTurn — no API, no live run — and each asserts the behaviour he
// described, not the code that produces it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import { serializeGapConfirmChoice } from '../lib/agent/gap-confirm-choice.ts';
import { memberDisplay } from '../lib/agent/member-display.ts';
import type { ConvState, ConvMessage } from '../lib/agent/onboarding.ts';

const GAP_STORY =
  'My dad was advancing through the stages of dementia, moving through levels of care as he declined. That landed ' +
  'on my sister hard and she was stressed out by it. I was watching my father slip and watching what it was doing ' +
  'to my family at the same time, and the comfort food came back and the weight started coming on.';

/** A member sitting at the gap confirm with a story told and Doors proposed — the state behind his screenshot. */
function atGapConfirm(): ConvState {
  return {
    stage: 'gap',
    awaitingConfirm: true,
    collected: { identityNoun: 'Racer', gap: GAP_STORY, doorsProposed: ['aging_parents', 'body', 'grind'] },
  } as ConvState;
}

// ── 1 · "There's more" is not a question to re-ask ────────────────────────────────────────────────────────────
test('tapping "There\'s more" invites the story instead of asking again whether there is one', () => {
  const tap = serializeGapConfirmChoice('more', ['aging_parents', 'body', 'grind']);
  const t = applyStagedTurn(atGapConfirm(), [], tap, { text: '' });

  assert.doesNotMatch(t.reply, /was there more|is there more|anything else tangled|did anything else pile/i,
    `re-asked the question the tap answered:\n  ${t.reply}`);
  assert.doesNotMatch(t.reply, /thank you for that/i, 'a tap carried no content — nothing to thank them for');
  assert.match(t.reply, /go on|listening|tell me the rest/i, 'the beat should open the door');
  assert.ok(t.reply.includes('?') || /tell me the rest/i.test(t.reply), 'it still hands the turn back');
});

test('a TYPED addition still gets the "was there more?" question — that path was never broken', () => {
  const typed = 'There was also the job. I got passed over twice and stopped putting my hand up.';
  const t = applyStagedTurn(atGapConfirm(), [], typed, { text: '' });
  assert.match(t.reply, /more|else|heart of it/i, 'a new chapter genuinely invites "or is that the heart of it?"');
});

test('the tap is still a FACT to the engine — its content is not written into the gap', () => {
  const tap = serializeGapConfirmChoice('more', ['grind']);
  const t = applyStagedTurn(atGapConfirm(), [], tap, { text: '' });
  const gap = (t.state.collected?.gap ?? '') as string;
  assert.doesNotMatch(gap, /\[gap-confirm\]/, 'the wire string must never reach the stored story');
  assert.ok(gap.includes('dementia'), 'and the story they already told is untouched');
});

// ── 2 · The model reads what the member saw ───────────────────────────────────────────────────────────────────
test('every machine format a member can send has a human rendering for the model', () => {
  // The exact strings the three tap surfaces emit. If a new one is added without a display rule,
  // tests/member-display.test.ts fails first; this asserts the ones that exist do not reach a reader raw.
  for (const wire of [
    serializeGapConfirmChoice('more', ['grind']),
    serializeGapConfirmChoice('done', []),
    '__identity_skip__',
  ]) {
    const shown = memberDisplay(wire);
    assert.notEqual(shown, wire, `${wire} still reaches the model as machine syntax`);
    assert.doesNotMatch(shown, /^\[|^__/, `${wire} → ${shown} is still machine-shaped`);
  }
});

test('an ordinary typed message is passed to the model verbatim', () => {
  const typed = "I'm not sure I want to name it yet — [not a tag] just thinking out loud.";
  assert.equal(memberDisplay(typed), typed, 'member prose must never be rewritten on its way to the model');
});

// ── 3 · Identity is not named off one thin line ───────────────────────────────────────────────────────────────
const IDENTITY_START: ConvState = { stage: 'identity', collected: {} } as ConvState;

test('candidates offered on the member\'s FIRST thin answer are held back for one more draw', () => {
  const t = applyStagedTurn(IDENTITY_START, [], 'I used to race bikes.', {
    text: 'That sounds like it mattered.',
    identityCandidates: ['Racer', 'Cyclist', 'Competitor'],
  } as never);

  assert.equal(t.expects, undefined, 'no chip chooser yet — one line is not a person we can see');
  assert.ok(t.reply.includes('?'), 'it draws them out instead');
  assert.equal(t.state.collected?.identityNoun, undefined, 'and nothing is named');
});

test('the second answer gets the chooser — a floor, not a wall', () => {
  const first = applyStagedTurn(IDENTITY_START, [], 'I used to race bikes.', {
    text: 'Tell me more.',
    identityCandidates: ['Racer'],
  } as never);
  const history: ConvMessage[] = [{ role: 'member', text: 'I used to race bikes.' }, { role: 'agent', text: first.reply }];
  const second = applyStagedTurn(first.state, history,
    'Crit racing every weekend, chasing summits, I was the one who dragged everyone out at 5am.', {
      text: 'I can see him.',
      identityCandidates: ['Racer', 'Cyclist'],
    } as never);

  assert.deepEqual(second.expects, { kind: 'identity_pick', candidates: ['Racer', 'Cyclist'] });
});

test('a front-loader is NOT held back — a rich first answer passes the floor immediately', () => {
  const rich =
    'I was a bike racer for fifteen years — crits every weekend, chasing summits in the Rockies, the guy who ' +
    'dragged everyone out at five in the morning and made it fun. That was who I was.';
  const t = applyStagedTurn({ stage: 'identity', collected: { athleticPast: rich } } as ConvState, [], rich, {
    text: 'I can see exactly who that was.',
    identityCandidates: ['Racer', 'Cyclist'],
  } as never);

  assert.deepEqual(t.expects, { kind: 'identity_pick', candidates: ['Racer', 'Cyclist'] },
    'someone who gave it all in one pass must not be made to repeat themselves');
});

test('the prompt now instructs set_past_self and asks for depth — Q8\'s cause', async () => {
  const src = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('../lib/agent/onboarding-staged.ts', import.meta.url), 'utf8'));
  // Slice FORWARD from the identity block. `indexOf('GAP STAGE')` alone lands on a code comment 1,300 lines
  // earlier ("A DOOR PROPOSAL CANNOT OUTLIVE THE GAP STAGE"), which produced a backwards slice and an empty
  // string — a test that failed while the thing it checks was already correct.
  const from = src.indexOf('IDENTITY STAGE:');
  assert.notEqual(from, -1, 'the identity stage instruction has moved or been renamed');
  const stage = src.slice(from, src.indexOf('GAP STAGE (', from));
  assert.match(stage, /call set_past_self/, 'set_past_self was never mentioned — which is why athleticPast was never stored');
  assert.match(stage, /BEFORE you offer any candidates/, 'the order matters: the words are theirs before the name is');
  assert.match(stage, /DEPTH is the goal/, 'identity gets the same depth instruction gap has');
});
