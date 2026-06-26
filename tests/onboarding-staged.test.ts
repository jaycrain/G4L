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

// --- slice c: the RECLAIM stage + end-to-end --------------------------------------------------------
test('STAGED reclaim — gather to the minimum → reflect the list → confirm → complete (hands off to the card)', () => {
  const atReclaim: ConvState = {
    stage: 'reclaim',
    collected: { athleticPast: 'a cyclist', identityNoun: 'Athlete', gap: 'It opened slowly over years of caring for my dad until I lost myself in it entirely.' },
  };
  const { turns, finalState } = replayStaged(
    [
      { member: 'I want to ride again', model: { text: 'Good.', record: { reclaimList: ['riding again'] } } },
      { member: 'and have my mornings back', model: { text: 'Yes.', record: { reclaimList: ['my mornings back'] } } },
      { member: 'and see my friends', model: { text: 'Got it.', record: { reclaimList: ['seeing my friends'] } } },
      { member: 'yes, that’s the whole list', model: { text: 'Okay.' } }, // closes at the minimum → reflect
      { member: 'yes, that’s right', model: { text: 'Okay.' } }, // confirm → complete
    ],
    atReclaim,
  );
  // at/above the minimum the engine gathers toward the aim; the member's CLOSE triggers the reflect-confirm
  assert.equal(turns[3]!.state.awaitingConfirm, true, 'closing at the minimum reflects the list');
  assert.match(turns[3]!.reply, /Reclaim List/i);
  assert.match(turns[3]!.reply, /riding again/);
  // confirm → complete + handoff to the card
  assert.equal(finalState.stage, 'complete');
  assert.equal(turns[4]!.complete, true, 'completes — the card renders from collected');
  assert.equal(finalState.collected.reclaimList?.length, 3);
  assert.match(turns[4]!.reply, /show you what I captured|tell me if/i);
});

test('STAGED reclaim — re-surfaces a parked front-loader item at stage entry (the trust moment)', () => {
  // Member parked "writing again" back in the identity stage; we enter reclaim by confirming the gap.
  const atGapConfirm: ConvState = {
    stage: 'gap', awaitingConfirm: true,
    collected: { athleticPast: 'a writer', identityNoun: 'Writer', gap: 'Work slowly took everything I had.', reclaimList: ['writing again'] },
  };
  const turn = applyStagedTurn(atGapConfirm, [], 'yes, that’s how it went', { text: 'Okay.' });
  assert.equal(turn.state.stage, 'reclaim', 'advanced into reclaim');
  assert.match(turn.reply, /earlier you told me/i, 'reads the parked item back');
  assert.match(turn.reply, /writing again/, 'names the exact parked want — nothing dropped');
});

test('STAGED reclaim — never-trap: a wrap below the minimum nudges ONCE, then does not loop or complete', () => {
  const atReclaim: ConvState = {
    stage: 'reclaim',
    collected: { athleticPast: 'a runner', identityNoun: 'Runner', gap: 'It faded over a long slow decade of putting everyone else first.', reclaimList: ['running'] },
  };
  // member gives a 2nd, then says "that's all" while still at 2 (below the min of 3)
  const { turns } = replayStaged(
    [
      { member: 'and getting outside', model: { text: 'Good.', record: { reclaimList: ['getting outside'] } } },
      { member: 'honestly that’s all I’ve got', model: { text: 'Okay.' } },
      { member: 'no really, I’m done', model: { text: 'Okay.' } },
    ],
    atReclaim,
  );
  // turn 2: wrap below min → nudge ONCE, do not complete
  assert.equal(turns[1]!.state.reclaimNudged, true, 'nudged once');
  assert.equal(turns[1]!.complete, false, 'never completes below the frozen floor');
  assert.match(turns[1]!.reply, /even one or two more|small/i, 'lowers the bar rather than re-asking');
  // turn 3: wraps again — must NOT nudge a second time (no loop) and still must not complete
  assert.equal(/even one or two more/i.test(turns[2]!.reply), false, 'does not repeat the nudge — no loop');
  assert.equal(turns[2]!.complete, false, 'still cannot complete below the minimum');
});

test('STAGED reclaim — backstop: model converses WITHOUT add_reclaim_item; engine captures the wants in-stage', () => {
  const atReclaim: ConvState = {
    stage: 'reclaim',
    collected: { athleticPast: 'a leader', identityNoun: 'Leader', gap: 'The layoff took the role, then everything else slowly went with it over a couple of hard years.' },
  };
  // The exact live failure the eval caught: the model reflects each want warmly but never tags it.
  const { turns, finalState } = replayStaged(
    [
      { member: 'I want paid creative work — writing, something that uses that part of my mind again', model: { text: 'That sounds important to you.' } },
      { member: 'and I want my financial independence back', model: { text: 'Of course.' } },
      { member: 'and to feel like myself in a room again', model: { text: 'I hear that.' } },
      { member: 'that’s everything', model: { text: 'Okay.' } }, // closes → reflect
      { member: 'yes', model: { text: 'Okay.' } }, // confirm → complete
    ],
    atReclaim,
  );
  assert.equal(finalState.collected.reclaimList?.length, 3, 'backstop captured all three untagged wants');
  assert.equal(finalState.stage, 'complete', 'reached the minimum and completed — no 0-item stall');
  assert.equal(turns.at(-1)!.complete, true);
  // a wrap/refusal in-stage is NOT captured as an item
  const wrapState: ConvState = { stage: 'reclaim', collected: { athleticPast: 'x', identityNoun: 'X', gap: 'a'.repeat(40), reclaimList: ['one'] } };
  const w = applyStagedTurn(wrapState, [], 'no, that’s all — I’m done, let’s move on', { text: 'Okay.' });
  assert.equal(w.state.collected.reclaimList?.length, 1, 'a wrap line never becomes a reclaim item');
});

// --- slice d: the fade gate (no-fade DECLINE) -------------------------------------------------------
test('STAGED fade gate — a no-fade optimizer is DECLINED, never force-completed (no gap, no Door)', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a founder', identitySkipped: true } };
  // Theo-shaped: no loss, only forward ambition. The model (correctly) does not tag set_gap.
  const { turns, finalState } = replayStaged(
    [
      { member: 'Honestly nothing went wrong — I’m thriving and I just want to optimize and level up further', model: { text: 'It sounds like things are good.' } },
      { member: 'Right, no loss or drift here. I want to scale my startup and run a faster marathon', model: { text: 'Got it.' } },
      { member: 'Exactly, I just want more — bigger challenges, keep pushing', model: { text: 'Understood.' } },
    ],
    atGap,
  );
  assert.equal(finalState.collected.gap ?? undefined, undefined, 'no fade fabricated');
  assert.deepEqual(finalState.collected.doors ?? [], [], 'no Door forced');
  assert.equal(finalState.noFade, true, 'recognized as no-fade');
  assert.equal(turns.at(-1)!.complete, false, 'never force-completes a non-member');
  assert.match(turns.at(-1)!.reply, /good place|distance from who|not be where you are/i, 'honest, non-pathologizing decline');
});

test('STAGED fade gate — does NOT misfire on a real fade that also mentions wanting more', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a runner', identityNoun: 'Runner' } };
  // Has a real loss AND forward language — the loss signal must win (isForwardAmbition is false when loss present).
  const story = 'After my divorce I lost myself and stopped running; now I want more from life again, to level up and feel alive.';
  const { turns } = replayStaged([{ member: story, model: { text: 'That makes sense.', record: { gap: story } } }], atGap);
  assert.equal(turns[0]!.state.collected.gap, story, 'a real fade with forward language is still captured');
  assert.equal(turns[0]!.state.noFade ?? false, false, 'not misread as no-fade');
  assert.equal(turns[0]!.state.awaitingConfirm, true, 'proceeds to reflect-confirm');
});

test('STAGED reclaim — sub-3 completion (Gate-1 decision): two items + done → completes, card carries shortfall', () => {
  const atReclaim: ConvState = {
    stage: 'reclaim',
    collected: { athleticPast: 'a writer', identityNoun: 'Writer', gap: 'Work slowly took everything over a long decade until I lost the thread of myself.', reclaimList: ['writing again'] },
  };
  const { turns, finalState } = replayStaged(
    [
      { member: 'and time to read', model: { text: 'Good.', record: { reclaimList: ['time to read'] } } }, // count 2
      { member: 'honestly that’s all', model: { text: 'Okay.' } }, // close below 3 → nudge once
      { member: 'no, that’s really it for me', model: { text: 'Okay.' } }, // still closing → accept (sub-3) → reflect
      { member: 'yes', model: { text: 'Okay.' } }, // confirm → complete
    ],
    atReclaim,
  );
  assert.equal(turns[1]!.state.reclaimNudged, true, 'nudged once below the aim');
  assert.match(turns[2]!.reply, /Reclaim List/i, 'accepts the sub-3 list and reflects (never fabricates a 3rd)');
  assert.equal(finalState.stage, 'complete', 'completes below the old ≥3 floor — card carries the shortfall');
  assert.equal(finalState.collected.reclaimList?.length, 2);
});

test('STAGED reclaim — caps runaway capture at the soft aim (no 17-item ballooning)', () => {
  const atReclaim: ConvState = {
    stage: 'reclaim',
    collected: { athleticPast: 'x', identityNoun: 'X', gap: 'a real fade that unfolded slowly after a hard loss and a long drift'.padEnd(70, '.') },
  };
  // Seven genuine offered wants — the 7th hits the aim and triggers reflect-confirm (no endless "what else?").
  const wants = ['one thing', 'another thing', 'a third', 'a fourth', 'a fifth', 'a sixth', 'a seventh', 'an eighth'];
  const { turns } = replayStaged(
    wants.map((w) => ({ member: `I want ${w} back`, model: { text: 'Good.', record: { reclaimList: [w] } } })),
    atReclaim,
  );
  const reflected = turns.findIndex((t) => t.state.awaitingConfirm);
  assert.ok(reflected >= 0 && reflected <= 6, 'reflects by the time the aim (~7) is hit, not after ballooning');
});

test('STAGED end-to-end — opening → identity → gap → reclaim → complete, full contract met', () => {
  const { turns, finalState } = replayStaged([
    { member: 'I used to be a competitive swimmer, up at 5am every day for the pool', model: { text: 'That dedication shows.', record: { athleticPast: 'a competitive swimmer up at 5am every day' } } },
    { member: 'The Swimmer', model: { text: 'The Swimmer.', record: { identityNoun: 'Swimmer' } } },
    { member: 'yes that’s right', model: { text: 'Good.' } },
    { member: 'After my divorce I just stopped. The early mornings went, then everything else, and I never found my way back to the water or to myself.', model: { text: 'That kind of unraveling is so common after a marriage ends.', record: { gap: 'After my divorce I stopped — the early mornings went, then everything else, and I never found my way back to the water or to myself.', doors: ['marriage'] } } },
    { member: 'yes, exactly', model: { text: 'Thank you.' } },
    { member: 'I want to swim again', model: { text: 'Good.', record: { reclaimList: ['swimming again'] } } },
    { member: 'my early mornings', model: { text: 'Yes.', record: { reclaimList: ['my early mornings'] } } },
    { member: 'and feeling strong in my body', model: { text: 'Got it.', record: { reclaimList: ['feeling strong in my body'] } } },
    { member: 'that’s everything', model: { text: 'Okay.' } }, // closes → reflect
    { member: 'yes, that’s right', model: { text: 'Okay.' } }, // confirm → complete
  ]);
  assert.equal(finalState.stage, 'complete');
  assert.equal(turns.at(-1)!.complete, true);
  const c = finalState.collected;
  assert.equal(c.identityNoun, 'Swimmer');
  assert.ok(c.gap && c.gap.length > 20);
  assert.deepEqual(c.doors, ['marriage']);
  assert.equal(c.reclaimList?.length, 3);
});
