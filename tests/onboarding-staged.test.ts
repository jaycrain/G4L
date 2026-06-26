import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyStagedTurn, stagedOpening, correctsReflection } from '../lib/agent/onboarding-staged.ts';
import type { ConvMessage, ConvState, ModelTurn, Turn } from '../lib/agent/onboarding.ts';

// Replay through the PURE staged engine (no API), the same discipline as tests/onboarding-replay.test.ts.
type Step = { member: string; model: ModelTurn };
function replayStaged(steps: Step[], from: ConvState = { stage: 'identity', collected: {} }) {
  let state = from;
  const history: ConvMessage[] = [];
  const turns: Turn[] = [];
  for (const s of steps) {
    const t = applyStagedTurn(state, history, s.member, s.model);
    turns.push(t);
    history.push({ role: 'member', text: s.member }, { role: 'agent', text: t.reply });
    state = t.state;
    if (t.complete) break;
  }
  return { turns, finalState: state };
}

test('STAGED opening — opens on the identity question, stage = identity', () => {
  const t = stagedOpening();
  assert.equal(t.state.stage, 'identity');
  assert.equal(t.complete, false);
  assert.match(t.reply, /most like yourself/i);
});

test('STAGED identity — gather → reflect-confirm → advance to the gap stage', () => {
  const { turns, finalState } = replayStaged([
    { member: 'I was a competitive cyclist who raced every weekend', model: { text: 'That comes through.', record: { athleticPast: 'a competitive cyclist who raced every weekend' } } },
    { member: 'The Athlete', model: { text: 'The Athlete.', record: { identityNoun: 'Athlete' } } },
    { member: 'Yes, that’s her', model: { text: 'Good.' } },
  ]);
  // turn 2: named → reflect-confirm + await confirm
  assert.equal(turns[1]!.state.awaitingConfirm, true, 'reflects the named identity and awaits confirm');
  assert.match(turns[1]!.reply, /Athlete/);
  assert.match(turns[1]!.reply, /did I get|right\?/i);
  // turn 3: affirm → advance + reframe
  assert.equal(finalState.stage, 'gap', 'advances to the gap stage on confirm');
  assert.equal(finalState.awaitingConfirm, false);
  assert.match(turns[2]!.reply, /how it went|distance started to open/i, 'reframes into how-it-opened');
  assert.equal(finalState.collected.identityNoun, 'Athlete');
});

test('STAGED identity — skip path advances straight to the gap stage (nothing to confirm)', () => {
  const { turns, finalState } = replayStaged([
    { member: 'I was someone who chased every new idea', model: { text: 'I hear that.', record: { athleticPast: 'someone who chased every new idea' } } },
    { member: 'honestly I’m not sure I can name it yet', model: { text: 'That’s okay.', record: { identitySkipped: true } } },
  ]);
  assert.equal(finalState.collected.identitySkipped, true);
  assert.equal(finalState.stage, 'gap', 'skip advances straight to the gap stage');
  assert.match(turns[1]!.reply, /find her through the work/i, 'acknowledges the skip warmly');
});

test('STAGED identity — a correction re-opens the stage (never advances on "no")', () => {
  const atReflect: ConvState = {
    stage: 'identity', awaitingConfirm: true, identityTurns: 1,
    collected: { athleticPast: 'a cyclist', identityNoun: 'Athlete' },
  };
  const turn = applyStagedTurn(atReflect, [], 'no, that’s not quite her — more the Builder', { text: 'Got it.' });
  assert.equal(turn.complete, false);
  assert.equal(turn.state.stage, 'identity', 'stays in identity on a correction');
  assert.equal(turn.state.awaitingConfirm, false, 'clears the pending confirm');
  assert.match(turn.reply, /truer|get it right|my mistake/i, 're-gathers the word');
});

test('STAGED identity — an ambiguous reply at confirm advances (never traps)', () => {
  const atReflect: ConvState = {
    stage: 'identity', awaitingConfirm: true, identityTurns: 1,
    collected: { athleticPast: 'a cyclist', identityNoun: 'Athlete' },
  };
  const turn = applyStagedTurn(atReflect, [], 'hmm, I think so', { text: 'Okay.' });
  assert.equal(turn.state.stage, 'gap', 'ambiguous (not a correction) advances — no trap');
});

test('correctsReflection — catches a real correction, not an affirmation', () => {
  assert.equal(correctsReflection('no, that’s not it'), true);
  assert.equal(correctsReflection('not quite — more the Builder'), true);
  assert.equal(correctsReflection('yes, that’s her'), false);
  assert.equal(correctsReflection('yeah no, that’s her'), false); // colloquial yes (affirmation guard)
  assert.equal(correctsReflection('perfect'), false);
});

// --- slice b: the GAP stage --------------------------------------------------------------------------
const GAP_STORY =
  'It was slow. My dad got sick and I became his caregiver, and somewhere in those years of appointments and ' +
  'worry I just stopped being anyone but the person who showed up for him. I never got back to my own life.';

test('STAGED gap — set_gap captures the story, derives the Door, reflect-confirm awaits, advances to reclaim', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a cyclist', identityNoun: 'Athlete' } };
  const { turns, finalState } = replayStaged(
    [
      { member: GAP_STORY, model: { text: 'That sounds like it took everything you had.', record: { gap: GAP_STORY, doors: ['aging_parents'] } } },
      { member: 'Yes, that’s how it went', model: { text: 'Okay.' } },
    ],
    atGap,
  );
  // turn 1: gap captured + Door derived + reflect-confirm
  assert.equal(turns[0]!.state.awaitingConfirm, true, 'reflects the gap and awaits confirm');
  assert.equal(turns[0]!.state.collected.gap, GAP_STORY);
  assert.deepEqual(turns[0]!.state.collected.doors, ['aging_parents'], 'Door tagged by the model is kept');
  assert.match(turns[0]!.reply, /come back to the specific doors|shape of how it went/i, 'forecasts the Doors session');
  // turn 2: affirm → advance to reclaim, ends on hope
  assert.equal(finalState.stage, 'reclaim', 'advances to the reclaim stage on confirm');
  assert.equal(finalState.awaitingConfirm, false);
  assert.match(turns[1]!.reply, /want back|good part/i, 'reframes into what they want back');
});

test('STAGED gap — no Door tagged is a complete capture (recognition over routing, never forced)', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a writer', identityNoun: 'Writer' } };
  // Pure drift, no nameable event — matchDoors finds nothing, the model tags nothing. A null Door is valid.
  const story =
    'I honestly cannot point to anything. There was no event, no crisis. I just slowly stopped doing the ' +
    'things I loved, a little at a time, and one day I looked up and they were gone. Nothing happened, exactly.';
  const { turns } = replayStaged([{ member: story, model: { text: 'I hear that.', record: { gap: story } } }], atGap);
  assert.equal(turns[0]!.state.awaitingConfirm, true, 'a gap with zero Doors still reflects + advances');
  assert.deepEqual(turns[0]!.state.collected.doors ?? [], [], 'no Door invented when none was described');
});

test('STAGED gap — backstop: model converses WITHOUT set_gap; engine captures the message in-stage', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a runner', identityNoun: 'Runner' } };
  // The most common real failure: the model reflects warmly but never calls the tool (record undefined).
  const story =
    'It was slow. I became the one caring for my aging mother — the role reversal where I was suddenly the ' +
    'parent to my own parent — and somewhere in those years I stopped being anyone but the person who showed up.';
  const { turns } = replayStaged([{ member: story, model: { text: 'That must have been so hard.' } }], atGap);
  assert.equal(turns[0]!.state.collected.gap, story, 'backstop captured the member’s own gap message');
  assert.equal(turns[0]!.state.awaitingConfirm, true, 'and moved to reflect-confirm — no loop on the opening question');
  assert.deepEqual(turns[0]!.state.collected.doors, ['aging_parents'], 'Door still derived from the captured gap');
});

test('STAGED gap — a correction re-opens the stage and clears the mis-captured story (never traps)', () => {
  const atConfirm: ConvState = {
    stage: 'gap', awaitingConfirm: true,
    collected: { athleticPast: 'a cyclist', identityNoun: 'Athlete', gap: GAP_STORY, doors: ['aging_parents'] },
  };
  const turn = applyStagedTurn(atConfirm, [], 'no, that’s not really how it went', { text: 'Okay.' });
  assert.equal(turn.state.stage, 'gap', 'stays in the gap stage on a correction');
  assert.equal(turn.state.awaitingConfirm, false, 'clears the pending confirm');
  assert.equal(turn.state.collected.gap, undefined, 're-gathers the corrected account');
  assert.deepEqual(turn.state.collected.doors, [], 'drops Doors derived from the wrong story');
  assert.match(turn.reply, /get this right|how it really went/i);
});

test('STAGED gap — a short wrap/affirm message does NOT get grabbed as the gap (backstop guard)', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a runner', identityNoun: 'Runner' } };
  const { turns } = replayStaged([{ member: 'yeah, let’s move on', model: { text: 'Take your time — how did it open?' } }], atGap);
  assert.equal(turns[0]!.state.collected.gap, undefined, 'a wrap line is never captured as the fade story');
  assert.equal(turns[0]!.state.awaitingConfirm ?? false, false, 'stays gathering — no false reflect-confirm');
});

test('STAGED gap — a reclaim item volunteered in-stage PARKS to the list, never the gap (the 37% killer)', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a runner', identityNoun: 'Runner' } };
  // Member drifts into a want while we're still on the gap; the model tags it add_reclaim_item, NOT set_gap.
  const { turns } = replayStaged(
    [{ member: 'I just really want to be running trails again on weekends', model: { text: "I'll hold onto that. But back to how the distance opened —", record: { reclaimList: ['running trails on weekends'] } } }],
    atGap,
  );
  assert.deepEqual(turns[0]!.state.collected.reclaimList, ['running trails on weekends'], 'parked to the Reclaim List');
  assert.equal(turns[0]!.state.collected.gap, undefined, 'NOT captured as the gap — staging makes contamination impossible');
  assert.equal(turns[0]!.state.stage, 'gap', 'stays in the gap stage, still gathering the fade story');
});
