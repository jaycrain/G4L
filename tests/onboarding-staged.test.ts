import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyStagedTurn, stagedOpening, correctsReflection, tidyGapProse, parseReclaimListSubmission } from '../lib/agent/onboarding-staged.ts';
import { memberClosingReclaim } from '../lib/agent/onboarding-intent.ts';
import { serializeGapConfirmChoice } from '../lib/agent/gap-confirm-choice.ts';
import { BEAT_SEP, doorsKnown, type ConvMessage, type ConvState, type ModelTurn, type Turn } from '../lib/agent/onboarding.ts';

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
    if (t.complete || t.declined) break; // a decline is terminal too — the client shows the decline, no more turns
  }
  return { turns, finalState: state };
}

// Onboarding no longer completes at the Reclaim seatbelt — once the capture is settled it hands into the
// administered "Introduction to Grinta" baseline survey, which is the new end of onboarding. These two helpers
// keep the Reclaim tests honest: assert the handoff, then (where the test's point is true completion) walk the
// 12 survey items to the card.
function assertHandsToGrinta(turn: Turn) {
  assert.equal(turn.complete ?? false, false, 'Reclaim hands into the Grinta survey, not straight to the card');
  assert.equal(turn.state.stage, 'grinta');
  assert.match(turn.reply, /1 \(not at all\) to 5/i, 'the survey opener + first item are delivered');
  // W-48: the "n of 12" cue moved from the bubble to the chip signal — the opener is the first item (Question 1 of 12).
  assert.equal(turn.expects?.index, 1, 'chip signal: first item');
  assert.equal(turn.expects?.total, 12, 'chip signal: 12-item length');
  // THREE beats now, not two. The first is the RECEIPT — Jay, 2026-08-14: he typed his Reclaim List and the next
  // bubble was "Before we go further, a quick baseline", with no sign we had read it. Receiving before you move
  // is its own job, so it gets its own bubble, the same way the Phases intro and the framing do.
  const bubbles = turn.reply.split(BEAT_SEP);
  assert.equal(bubbles.length, 3, 'receipt | the Phases intro | the pre-survey framing + first item');
  // Bubble 1 is a RECEIPT, from whichever source has one: the model's own in-voice acknowledgment when it wrote
  // something ("Mm.", "Okay."), and the engine reciting their list back when it didn't — which is the common
  // case, because the list arrives from the structured builder with no prose attached. What must never happen
  // is what Jay saw: the scripted frame first, as if nothing had been typed.
  assert.doesNotMatch(bubbles[0]!, /twelve questions/i, 'something must be said before the baseline frame');
  // Anchored on "twelve questions" rather than a stylistic phrase: it identifies the baseline intro AND guards
  // the count the member is promised, which must match ONBOARDING_BASELINE_ITEMS.length.
  assert.match(bubbles[1]!, /twelve questions/i, 'bubble 2 = the Grinta baseline intro');
  assert.match(bubbles[2]!, /1 \(not at all\) to 5/i, 'bubble 3 = the pre-survey framing + the first item');
}
// Answer the 12-item survey with `val` (default 3); returns the final (completing) turn.
function walkSurvey(state: ConvState, history: ConvMessage[] = [], val = 3): Turn {
  let s = state;
  let turn = null as unknown as Turn;
  for (let i = 0; i < 12; i++) {
    turn = applyStagedTurn(s, history, String(val), { text: '' });
    s = turn.state;
  }
  return turn;
}

test('STAGED opening — opens on the identity question, stage = identity', () => {
  const t = stagedOpening();
  assert.equal(t.state.stage, 'identity');
  assert.equal(t.complete, false);
  assert.match(t.reply, /feel most like yourself/i);
});

test('STAGED identity — breathe floor (1a): gather → PROBE the person → reflect-confirm → advance', () => {
  const { turns, finalState } = replayStaged([
    { member: 'I was a competitive cyclist who raced every weekend', model: { text: 'That comes through.', record: { athleticPast: 'a competitive cyclist who raced every weekend' } } },
    { member: 'The Athlete', model: { text: 'The Athlete.', record: { identityNoun: 'Athlete' } } },
    { member: 'It felt like flying — free and strong, the road mine before anyone else was up', model: { text: 'I can feel that.', record: { athleticPast: 'the Athlete — raced every weekend, felt like flying, free and strong, the road hers before dawn' } } },
    { member: 'Yes, that’s her', model: { text: 'Good.' } },
  ]);
  // turn 2: the name lands, but the FLOOR HOLDS — draw the person out; never race to confirm (Scott's "rushed").
  assert.equal(turns[1]!.state.awaitingConfirm, false, 'floor holds — a bare noun does not race to reflect-confirm');
  assert.match(turns[1]!.reply, /feel|most true|being the Athlete/i, 'it probes the person instead');
  // turn 3: the probe answer enriched the material → reflect-confirm, quoting the member's OWN specifics (1b substantive).
  assert.equal(turns[2]!.state.awaitingConfirm, true, 'once rich, reflects and awaits confirm (no needless 2nd probe)');
  assert.match(turns[2]!.reply, /Athlete/);
  assert.match(turns[2]!.reply, /felt like flying|free and strong/, 'reflection names the member’s own specifics');
  assert.match(turns[2]!.reply, /did I get|right\?/i);
  // turn 4: affirm → advance, BRIDGING from the named identity into how the gap opened (not a cold switch).
  assert.equal(finalState.stage, 'gap', 'advances to the gap stage on confirm');
  // INVERTED (Cowork + Jay, 2026-08-14): this beat used to carry "the Athlete" three times and now must carry
  // it none. The bridge is still a bridge — it opens on "Then", straight off the naming — but it addresses the
  // person who just did the naming instead of discussing them in the third person.
  assert.match(turns[3]!.reply, /^Then let's find out what happened/, 'still bridges off the naming beat');
  assert.doesNotMatch(turns[3]!.reply, /the Athlete/i, 'never refers to the member in the third person by their Identity');
  assert.match(turns[3]!.reply, /Doors/, 'introduces Doors at first use');
  assert.equal(finalState.collected.identityNoun, 'Athlete');
});

test('STAGED identity→gap bridge (1b): skipped identity falls back to the standalone gap opener (no name to bridge)', () => {
  const { turns } = replayStaged([
    { member: 'I chased every new idea', model: { text: 'I hear that.', record: { athleticPast: 'someone who chased every new idea' } } },
    { member: 'I can’t name it yet', model: { text: 'That’s okay.', record: { identitySkipped: true } } },
  ]);
  // skip → SKIP_ACK + the standalone gapOpen (can't bridge from a name that was never given), still warm + Doors.
  assert.match(turns[1]!.reply, /find your way back to them/i, 'acknowledges the skip');
  assert.match(turns[1]!.reply, /Doors/, 'still opens the gap thread with the Door frame');
});

test('STAGED identity — front-loader ESCAPE (1a): a rich one-pass identity reflects immediately, no extra probe', () => {
  const rich =
    'I was the one up at 5am to train before work, racing every weekend, completely alive on the bike — friends literally called me the engine of the group';
  const { turns } = replayStaged([
    { member: rich, model: { text: 'That’s vivid.', record: { athleticPast: rich, identityNoun: 'Athlete' } } },
  ]);
  // rich story + a name in ONE pass → the already-satisfied escape fires → reflect-confirm now (don't trap the ready).
  assert.equal(turns[0]!.state.awaitingConfirm, true, 'front-loader escape: reflects immediately on rich material');
  assert.match(turns[0]!.reply, /Athlete/);
});

test('STAGED identity — pushed-past ESCAPE (1a): the terse member is not trapped by the floor', () => {
  const { turns } = replayStaged([
    { member: 'I guess a runner', model: { text: 'A runner.', record: { athleticPast: 'a runner', identityNoun: 'Runner' } } },
    { member: 'that’s really it, can we move on', model: { text: 'Of course.' } },
  ]);
  // turn 1: a thin one-word identity → floor holds → probe (don't race).
  assert.equal(turns[0]!.state.awaitingConfirm, false, 'floor holds on the thin answer');
  // turn 2: the member pushes past the invitation → member-pushed-past escape → advance to confirm, never looped.
  assert.equal(turns[1]!.state.awaitingConfirm, true, 'pushed-past escape: honors the terse member, never loops');
});

test('STAGED identity — conditional 2nd probe (1b/Decision S): a shrug persona gets ONE concrete second draw, then caps (never loops)', () => {
  const { turns } = replayStaged([
    { member: 'I dunno, a dad I guess', model: { text: 'Okay.', record: { athleticPast: 'a dad', identityNoun: 'Dad' } } },
    { member: 'it was just normal, nothing special', model: { text: 'Mm.' } }, // still thin after probe 1
    { member: 'honestly I can’t really think of anything', model: { text: 'That’s okay.' } }, // still thin after probe 2
  ]);
  // turn 1: name lands thin → probe 1 (the general draw).
  assert.equal(turns[0]!.state.awaitingConfirm, false, 'probe 1 fires (thin)');
  assert.match(turns[0]!.reply, /take me back into being/i, 'the general first probe');
  // turn 2: STILL thin → probe 2 (smaller + concrete — "the net"), never re-asking probe 1.
  assert.equal(turns[1]!.state.awaitingConfirm, false, 'probe 2 fires because still thin');
  assert.match(turns[1]!.reply, /one small moment|little thing|no wrong answer/i, 'goes concrete, does not re-ask probe 1');
  // turn 3: still thin after two probes → CAP: reflect and move on, never a third probe / loop.
  assert.equal(turns[2]!.state.awaitingConfirm, true, 'capped at two probes → reflect, never loops');
});

test('STAGED gap — depth FLOOR (v2.1): the engine holds the beat open even if the model rushes reflect_gap on turn 1', () => {
  // The v2.0/v2.1 rush was an engine heuristic (door-count) advancing on two brief mentions. Now the floor holds
  // the beat open until it has genuinely breathed — even with 2 Doors AND the model signalling ready on turn 1.
  const story = 'I got laid off after twenty years, and then my mother’s health collapsed and I became her caretaker overnight';
  const { turns } = replayStaged(
    [{ member: story, model: { text: 'What did that first year feel like?', record: { gap: story, doors: ['career_cliff', 'aging_parents'] }, gapReady: true } }],
    { stage: 'gap', collected: { athleticPast: 'a cyclist', identityNoun: 'Athlete' } },
  );
  assert.equal(turns[0]!.state.awaitingConfirm ?? false, false, 'floor holds — no reflect on turn 1, even on a rich multi-Door pass with reflect_gap');
  assert.ok(doorsKnown(turns[0]!.state.collected).length >= 2, 'Doors still captured (as a PROPOSAL until she rules)');
});

test('STAGED gap — model-judged advance (v2.1): drawn out over exchanges, THEN reflect_gap → reflect-confirm → reclaim', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a cyclist', identityNoun: 'Athlete' } };
  const { turns, finalState } = replayStaged(
    [
      { member: GAP_STORY, model: { text: 'When did you first feel yourself disappearing into it?', record: { gap: GAP_STORY, doors: ['aging_parents'] } } },
      { member: 'Around the third year — I looked up and had no friends left, nothing that was mine', model: { text: 'That’s the cost of it — everything that was yours, gone quiet.', record: { gap: GAP_STORY + ' Around the third year, no friends left, nothing mine.' }, gapReady: true } },
      { member: 'Yes, you’ve got it', model: { text: 'Okay.' } },
    ],
    atGap,
  );
  // turn 1: gap + Door captured, but the engine keeps DRAWING OUT (a depth question, no reflect_gap yet).
  assert.equal(turns[0]!.state.awaitingConfirm ?? false, false, 'draws out — does not reflect on the first pass');
  assert.deepEqual(doorsKnown(turns[0]!.state.collected), ['aging_parents'], 'Door tagged by the model is kept — pending her ruling');
  // turn 2: floor met + the model judges it drawn out (reflect_gap) → reflect-confirm.
  assert.equal(turns[1]!.state.awaitingConfirm, true, 'reflects once the model judges it drawn out (floor met)');
  assert.match(turns[1]!.reply, /does it land|is there more/i, 'a clear, non-generic confirm');
  // turn 3: affirm → advance to reclaim.
  assert.equal(finalState.stage, 'reclaim', 'advances to the reclaim stage on confirm');
});

test('STAGED gap — "there was work too" at the confirm is heard as MORE, not a move-on (Jay walk 3/5/6)', () => {
  // The reflect-confirm asks "…does it land, or is there more to it?" An answer that ADDS a thread ("yeah,
  // there was work too") used to read as confirmation → premature jump to Reclaim → the model backtracked and
  // gap-answers polluted the list. It must STAY in gap, append the thread, and draw it out.
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a competitor', identityNoun: 'Player' } };
  const { turns, finalState } = replayStaged(
    [
      { member: 'I got married and had kids and just stopped competing', model: { text: 'When did you first feel that version of you getting further away?', record: { gap: 'Married, had kids, stopped competing.', doors: ['full_house'] } } },
      { member: 'Around 45 — I looked in the mirror and didn’t recognize the guy who used to win', model: { text: 'That’s a real loss — the one who showed up and won, gone quiet.', record: { gap: 'Married, kids, stopped competing; by 45 didn’t recognize the guy who used to win.' }, gapReady: true } },
      { member: 'Yeah, there was work too — it piled on and crowded everything out', model: { text: 'Tell me how the work fit in — did it crowd out the competitor, or hit differently?', record: {} } },
    ],
    atGap,
  );
  assert.equal(turns[1]!.state.awaitingConfirm, true, 'reflects once the model judges it drawn out');
  assert.equal(finalState.stage, 'gap', 'invited more KEEPS the beat in gap — never jumps to Reclaim');
  assert.equal(finalState.awaitingConfirm, false, 're-opens the draw for the new thread');
  assert.match(finalState.collected.gap ?? '', /work too/i, 'the new thread is appended — never dropped');
  assert.equal(finalState.collected.reclaimList?.length ?? 0, 0, 'no gap-answer leaks onto the reclaim list');
  assert.match(turns[2]!.reply, /\?\s*$/, 'the turn ends on a forward question — the conversation keeps going');
});

test('STAGED gap — a plain confirm ("yes, you’ve got it" / "exactly") still ADVANCES (not misread as more)', () => {
  // The flip side of the fixture above: the addition-detector must NOT trap a bare confirmation.
  const atConfirm: ConvState = { stage: 'gap', awaitingConfirm: true, stageScratch: { gap: { gapDepth: 2 } }, collected: { athleticPast: 'a runner', identityNoun: 'Runner', gap: 'The caregiving years took it.', doors: ['aging_parents'] } };
  for (const msg of ['yes, you’ve got it', 'exactly', 'yeah that’s right', 'that lands']) {
    const turn = applyStagedTurn(atConfirm, [], msg, { text: 'Okay.' });
    assert.equal(turn.state.stage, 'reclaim', `"${msg}" is a confirmation → advances to reclaim`);
  }
});

test('STAGED gap confirm — done-signals ADVANCE, never loop (Jay walk: "won\'t take yes for an answer")', () => {
  const atConfirm = (): ConvState => ({
    stage: 'gap', awaitingConfirm: true, stageScratch: { gap: { gapDepth: 3 } },
    collected: { athleticPast: 'a cyclist', identityNoun: 'Free Spirit', gap: 'Kids and work crowded it out over fifteen years.', doors: ['full_house', 'grind'] },
  });
  // Every one of these answers "…or is there more to it?" with NO MORE — they must ADVANCE, not loop.
  for (const msg of ["That's more or less it for now", "That's it", 'Nope', 'No more', 'Yeah, that about sums it up', 'I just did']) {
    const turn = applyStagedTurn(atConfirm(), [], msg, { text: 'Got it.' });
    assert.equal(turn.state.stage, 'reclaim', `"${msg}" at the gap confirm advances to reclaim (no loop)`);
  }
  // A real DISPUTE still reopens — and keeps the gap + Doors.
  const disp = applyStagedTurn(atConfirm(), [], "No, that's not quite right", { text: 'Okay.' });
  assert.equal(disp.state.stage, 'gap', 'a dispute stays in gap');
  assert.match(disp.reply, /get this right|how it really went/i, 'reopens to get it right');
  assert.match(disp.state.collected.gap ?? '', /crowded it out/, 'keeps the gap on a dispute (never wipe)');
  // Substantive NEW material still draws out (never advances past invited more).
  const more = applyStagedTurn(atConfirm(), [], 'Actually there was also my divorce that year — it wrecked me', { text: 'Tell me about that.' });
  assert.equal(more.state.stage, 'gap', 'new material keeps drawing out in gap');
  assert.equal(more.state.awaitingConfirm, false, 'draws out the new thread');
  assert.match(more.state.collected.gap ?? '', /divorce/i, 'appends the new material — never dropped');
});

test('STAGED confirm bounce — SHARED ceiling stops the rambler loop in every stage (torture harness)', () => {
  // One shared contract: each stage's CONFIRM re-opened forever when a rambler's reply never reads as a clean "done".
  // Past CONFIRM_BOUNCE_CEILING the beat closes on the stage's own advance path — content already captured.

  // GAP: every reply an 'addition' → append → re-ask "…or is there more?" forever. Past the ceiling → advance, kept.
  const gapConfirm = (): ConvState => ({
    stage: 'gap', awaitingConfirm: true, stageScratch: { gap: { confirmBounces: 4 } },
    collected: { athleticPast: 'a cyclist', identityNoun: 'Free Spirit', gap: 'Kids and work crowded it out over fifteen years.', doors: ['full_house', 'grind'] },
  });
  const gapRambled = applyStagedTurn(gapConfirm(), [], 'Actually there was also my divorce that year — it wrecked me', { text: 'Tell me about that.' });
  assert.equal(gapRambled.state.stage, 'reclaim', 'gap: past the ceiling, an addition advances instead of looping');
  assert.match(gapRambled.state.collected.gap ?? '', /divorce/i, 'gap: the final addition is still appended — never dropped');

  // IDENTITY: repeated dispute → reopen forever. Past the ceiling → SKIP (never commit a disputed name), advance.
  const idConfirm: ConvState = {
    stage: 'identity', awaitingConfirm: true, stageScratch: { identity: { confirmBounces: 4 } },
    collected: { athleticPast: 'a runner', identityNoun: 'Runner' },
  };
  const idDisputed = applyStagedTurn(idConfirm, [], "no that's not it either", { text: 'Okay.', replyIntent: 'dispute' });
  assert.equal(idDisputed.state.stage, 'gap', 'identity: past the ceiling, a persistent dispute skips forward');
  assert.equal(idDisputed.state.collected.identitySkipped, true, 'identity: skipped rather than committing a wrong name');
  assert.ok(!idDisputed.state.collected.identityNoun, 'identity: never names an unconfirmed identity (governance)');

  // RECLAIM IS NO LONGER PART OF THIS CONTRACT (2026-08-22, widget-first). Its section asserted that past the
  // ceiling a late-want advances instead of re-reflecting forever — a real bug, in a loop that cannot occur now:
  // the stage has no prose gather and no confirm bounce, because the builder is the only writer and it either
  // meets the floor or re-opens. There is nothing to ramble at.
  //
  // The gap and identity halves above are untouched and still carry the shared contract.
});

test('STAGED gap — CAP (v2.1): a member who keeps giving is never looped forever — the beat closes by GAP_MAX_DEPTH', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a cyclist', identityNoun: 'Athlete' } };
  // The model never calls reflect_gap; the member keeps adding. The engine must close it by the cap, not loop.
  const steps = Array.from({ length: 6 }, (_, i) => ({
    member: `chapter ${i}: another thing that piled on that year`,
    model: { text: 'Tell me more.', record: { gap: `${GAP_STORY} (${i})`, doors: ['aging_parents'] } },
  }));
  const { turns } = replayStaged(steps, atGap);
  assert.ok(turns.some((t) => t.state.awaitingConfirm), 'the cap closes the beat — never an unbounded loop');
});

test('STAGED identity — skip path advances straight to the gap stage (nothing to confirm)', () => {
  const { turns, finalState } = replayStaged([
    { member: 'I was someone who chased every new idea', model: { text: 'I hear that.', record: { athleticPast: 'someone who chased every new idea' } } },
    { member: 'honestly I’m not sure I can name it yet', model: { text: 'That’s okay.', record: { identitySkipped: true } } },
  ]);
  assert.equal(finalState.collected.identitySkipped, true);
  assert.equal(finalState.stage, 'gap', 'skip advances straight to the gap stage');
  assert.match(turns[1]!.reply, /find your way back to them/i, 'acknowledges the skip warmly');
});

test('STAGED identity — a correction re-opens the stage (never advances on "no")', () => {
  const atReflect: ConvState = {
    stage: 'identity', awaitingConfirm: true, stageScratch: { identity: { identityTurns: 1 } },
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
    stage: 'identity', awaitingConfirm: true, stageScratch: { identity: { identityTurns: 1 } },
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
      { member: 'That’s the whole of it', model: { text: 'Thank you.' } }, // signals the story whole → reflect
      { member: 'Yes, you’ve got it', model: { text: 'Okay.' } }, // confirm → advance
    ],
    atGap,
  );
  // turn 1: gap captured + Door derived, but still RECEIVING (invites the rest before reflecting)
  assert.equal(turns[0]!.state.collected.gap, GAP_STORY);
  assert.deepEqual(doorsKnown(turns[0]!.state.collected), ['aging_parents'], 'Door tagged by the model is kept — pending her ruling');
  assert.equal(turns[0]!.state.awaitingConfirm ?? false, false, 'gathers the whole story before reflecting');
  // turn 2: member signals the story whole ("that's the whole of it") → pushed-past → reflect-confirm.
  assert.equal(turns[1]!.state.awaitingConfirm, true, 'reflects once the member signals the story is whole');
  assert.match(turns[1]!.reply, /does it land|is there more/i, 'a clear confirm (no dismissive "Doors session later")');
  // turn 3: affirm → advance to reclaim, ends on hope
  assert.equal(finalState.stage, 'reclaim', 'advances to the reclaim stage on confirm');
  assert.equal(finalState.awaitingConfirm, false);
  assert.match(turns[2]!.reply, /want back|good part/i, 'reframes into what they want back');
});

test('STAGED gap — no Door tagged is a complete capture (recognition over routing, never forced)', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a writer', identityNoun: 'Writer' } };
  // Pure drift, no nameable event — matchDoors finds nothing, the model tags nothing. A null Door is valid.
  const story =
    'I honestly cannot point to anything. There was no event, no crisis. I just slowly stopped doing the ' +
    'things I loved, a little at a time, and one day I looked up and they were gone. Nothing happened, exactly.';
  const { turns } = replayStaged(
    [
      { member: story, model: { text: 'I hear that.', record: { gap: story } } },
      { member: 'That’s the whole picture', model: { text: 'Okay.' } }, // whole → reflect
    ],
    atGap,
  );
  assert.equal(turns[1]!.state.awaitingConfirm, true, 'a gap with zero Doors still reflects once whole');
  assert.deepEqual(doorsKnown(turns[1]!.state.collected), [], 'no Door invented when none was described — not even as a proposal');
});

test('STAGED gap — never-strand (run-2 fix): short progressive turns the matcher misses still get captured', () => {
  // Each message is short and uses phrasing matchDoors doesn't catch + the model never tags set_gap — exactly
  // the run-2 stall. After a few turns the engine must capture the accumulated story and advance, not loop.
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a leader', identitySkipped: true } };
  const { turns } = replayStaged(
    [
      { member: 'It all came apart at once, honestly.', model: { text: 'Tell me more.' } },
      { member: 'The work thing ended after a long time there.', model: { text: 'Go on.' } },
      { member: 'Then money got really tight at home.', model: { text: 'That’s hard.' } },
      { member: 'And someone close needed me at the same time.', model: { text: 'I hear you.' } },
      { member: 'That’s the whole of it.', model: { text: 'Thank you.' } }, // signals whole → reflect
    ],
    atGap,
  );
  assert.ok((turns[3]!.state.collected.gap ?? '').length > 0, 'by turn 4 the accumulated story is captured — no 24-turn stall');
  assert.equal(/feel like yourself/i.test(turns[3]!.reply), false); // not looping the opening question
  assert.equal(turns[4]!.state.awaitingConfirm, true, 'and the stage advances to reflect-confirm when she signals whole');
});

test('STAGED — runaway backstop fires on STALL, not length: a genuine stall (nothing new) is bounded to the card', () => {
  // A member whose data is all captured but who has now gone quiet — several turns adding nothing usable. The
  // backstop routes to the card. (Trigger is the idle counter, NOT turn count — a verbose member never trips it.)
  const stalled: ConvState = {
    stage: 'reclaim',
    idleTurns: 2, // already two no-progress turns
    collected: {
      identityNoun: 'Performer',
      gap: 'A diagnosis ended touring, then the band dissolved, then a move wiped out the whole music community.',
      doors: ['diagnosis', 'vanishing'],
      reclaimList: ['play live again', 'write weekly', 'sleep normally'],
    },
  };
  const turn = applyStagedTurn(stalled, [], 'meh, i dunno', { text: 'Mm.' }); // a third empty turn tips the idle limit
  assertHandsToGrinta(turn); // a genuine stall past the idle limit is bounded — to the survey, which then completes
  const done = walkSurvey(turn.state);
  assert.equal(done.complete, true, 'the survey then completes to the card');
  assert.match(done.reply, /look like you|captured/i);
});

test('STAGED — runaway backstop: a STALLED gap (real gap in hand, nothing new) is force-advanced to Reclaim', () => {
  const stuckInGap: ConvState = {
    stage: 'gap',
    idleTurns: 2,
    collected: {
      identityNoun: 'Performer',
      gap: 'A vocal-cord diagnosis ended touring, then the band dissolved, then a move wiped out the music community.',
      doors: ['diagnosis', 'vanishing'],
    },
  };
  const turn = applyStagedTurn(stuckInGap, [], 'idk', { text: 'Mm.' }); // nothing new → tips the idle limit
  assert.equal(turn.state.stage, 'reclaim', 'a stalled gap is moved on to Reclaim, not looping "was there more?"');
  assert.equal(turn.complete, false, 'not completed yet — she still names what she wants back');
  assert.match(turn.reply, /want back|reclaim/i);
});

test('STAGED — the ABSOLUTE ceiling still bounds a true runaway, and captures the last want before completing', () => {
  const history: ConvMessage[] = [];
  for (let i = 0; i < 29; i++) history.push({ role: 'member', text: `turn ${i}` });
  const state: ConvState = {
    stage: 'reclaim',
    collected: { athleticPast: 'a triathlete', identityNoun: 'Ironman Triathlete', gap: 'It opened slowly over years — the grind grew, the family needed more, and he lost the fitness and outlet that held him together.', reclaimList: ['My fitness', 'Get down to 190 lbs', 'See friends more'] },
  };
  const turn = applyStagedTurn(state, history, 'Write the second edition of my book', { text: 'Great, noted.' });
  assert.ok((turn.state.collected.reclaimList ?? []).some((x) => /second edition/i.test(x)), 'the just-offered want is captured before the ceiling ends gathering, not dropped');
  assertHandsToGrinta(turn); // the absolute ceiling ends the engaged gather — into the survey, which completes
});

test('STAGED — systemic gather-cap NEVER fires early or on a thin capture (no premature completion)', () => {
  // Same long history, but NOT card-ready (no gap yet) → must NOT force-complete; keeps gathering.
  const history: ConvMessage[] = [];
  for (let i = 0; i < 19; i++) history.push({ role: 'member', text: `x ${i}` }, { role: 'agent', text: 'go on' });
  const notReady: ConvState = { stage: 'gap', collected: { identitySkipped: true } }; // no gap, no reclaim
  const turn = applyStagedTurn(notReady, history, 'hmm', { text: 'Mm.' });
  assert.equal(turn.complete, false, 'never completes without the full finalize floor, even past the budget');
  // And the cap is well above normal completion: an early card-ready turn does NOT trigger it.
  const earlyReady: ConvState = {
    stage: 'reclaim',
    collected: { identityNoun: 'Runner', gap: 'a real fade over a long slow decade of putting everyone else first', reclaimList: ['run', 'sleep', 'friends'] },
  };
  const early = applyStagedTurn(earlyReady, [{ role: 'member', text: 'one' }, { role: 'agent', text: 'two' }], 'and painting', { text: 'Good.', record: { reclaimList: ['painting'] } });
  assert.equal(early.complete, false, 'at turn ~2 it gathers normally — the cap is a backstop, not the path');
});

test('STAGED gap — never-strand fires even when her LATEST turn is a frustrated deflection (run-5 fix)', () => {
  // The story is in earlier turns; by the time the never-strand window opens she's gotten frustrated and is
  // deflecting. We must still capture what she told us — not strand her because the current turn is a refusal.
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a leader', identitySkipped: true } };
  const { turns } = replayStaged(
    [
      { member: 'It started when I lost my job after years there.', model: { text: 'Mm.' } },
      { member: 'Then the money got tight and things at home unravelled.', model: { text: 'I see.' } },
      { member: 'I already told you this.', model: { text: 'Sorry.' } }, // frustration begins
      { member: 'We did this already, can we move on?', model: { text: 'Of course.' } }, // deflecting now
    ],
    atGap,
  );
  const last = turns.at(-1)!;
  assert.ok((last.state.collected.gap ?? '').length > 0, 'captured the earlier story despite the current deflection');
  assert.match(last.state.collected.gap!, /lost my job/, 'the accumulated corpus holds her real account');
});

test('STAGED reclaim — complete-when-done still GATHERS while she is actively adding (no premature reflect)', () => {
  const atReclaim: ConvState = {
    stage: 'reclaim',
    collected: { athleticPast: 'a runner', identityNoun: 'Runner', gap: 'a'.repeat(60), reclaimList: ['running', 'sleep', 'friends'] },
  };
  // She adds a 4th item (model tags it) — still below the aim → keep gathering, do NOT reflect yet.
  const turn = applyStagedTurn(atReclaim, [], 'oh and painting too', { text: 'Good.', record: { reclaimList: ['painting'] } });
  assert.equal(turn.state.collected.reclaimList?.length, 4);
  assert.equal(turn.state.awaitingConfirm ?? false, false, 'still gathering toward the aim while she adds');
});

test('STAGED gap — the "was there more?" nudge NEVER repeats verbatim across chapters (live-walk bug)', () => {
  // The live fresh-signup walk showed the static GAP_MORE repeated word-for-word across work → marriage →
  // "my marriage". The gather must rotate the nudge and never emit the identical line twice in a row.
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'an athlete', identityNoun: 'Ironman', gap: 'I was laid off after a long run there.' } };
  // Each chapter names a Door (so it appends + grows the gap → the engine nudges each turn). The model gives no
  // question, forcing the engine's fallback — which must rotate, never repeat the identical line.
  const { turns } = replayStaged(
    [
      { member: 'my marriage drifted into just coexisting', model: { text: 'I hear that.' } },
      { member: 'then came a diagnosis I couldn’t look away from', model: { text: 'Mm.' } },
    ],
    atGap,
  );
  assert.notEqual(turns[0]!.reply, turns[1]!.reply, 'two consecutive gather nudges are NOT identical (no verbatim loop)');
  for (const t of turns) assert.equal(/feel like yourself/i.test(t.reply), false, 'never loops the opening question');
  assert.match(turns[0]!.reply, /more|heart of/i, 'still a real "is there more?" gather prompt');
});

test('STAGED — general no-verbatim-repeat guard: a static opener/nudge is never emitted twice in a row', () => {
  // The eval's repeat-detector caught STAGED_OPENING (identity) and gapOpen re-emitting verbatim when a member
  // stalls. The engine-level guard must vary ANY line that would equal the last agent reply.
  const opener = stagedOpening().reply;
  const t = applyStagedTurn({ stage: 'identity', collected: {} }, [{ role: 'agent', text: opener }], 'hmm, not sure', { text: 'Mm.' });
  assert.notEqual(t.reply, opener, 'does not repeat the opener verbatim');
  assert.match(t.reply, /feel like yourself/i, 'still carries the identity prompt (varied, not lost)');
});

test('STAGED identity — a model that asks its own question (long coda) never re-appends the cold-open (Donna walk)', () => {
  // Donna's walk: she described her past self; the model reflected it and asked a real follow-up, THEN added a
  // longer invitation coda ("…what did that look like for you? Give me a glimpse of what that version of you was
  // actually doing.") without yet tagging set_athletic_past. The old char-window heuristic missed the mid-paragraph
  // '?' and bolted the ENTIRE STAGED_OPENING underneath — a verbatim repeat of the opening, two questions in one
  // bubble. When the model already led with a question, the engine must append NOTHING.
  const opener = stagedOpening().reply;
  const modelText =
    "That's a real picture — creative, funny, free, optimistic. I want to make sure I hold that right — when you " +
    'say creative, what did that look like for you? Give me a glimpse of what that version of you was actually doing.';
  const t = applyStagedTurn(
    { stage: 'identity', collected: {} },
    [{ role: 'agent', text: opener }],
    'I was creative, funny, free, optimistic — someone who moved through the world with a lightness',
    { text: modelText },
  );
  assert.equal(t.reply, modelText, 'the model already asked — the engine appends nothing (no second question, no opening)');
  assert.equal(/Tell me about them\./.test(t.reply), false, 'the cold-open is never re-emitted');
  assert.equal(t.state.stage, 'identity', 'still gathering the past self');
});

test('STAGED identity — with NO model question, the re-draw is SHORT, never the whole cold-open', () => {
  // Same stage, but the model just acknowledged with no forward question. The engine adds a probe — which must be
  // the short re-pose, not the multi-paragraph cold-open (on turn 2+ she has already answered the opening).
  const opener = stagedOpening().reply;
  const t = applyStagedTurn(
    { stage: 'identity', collected: {} },
    [{ role: 'agent', text: opener }],
    'I was creative and free back then',
    { text: 'Mm.' },
  );
  assert.match(t.reply, /feel like yourself/i, 're-poses the past-self question');
  assert.equal(/Tell me about them\./.test(t.reply), false, 'never the whole cold-open');
  assert.ok(t.reply.length < opener.length, 'the re-draw is materially shorter than the cold-open');
});

test('STAGED terminal — CONFIRM-ONLY card: the Reclaim List is FROZEN, no post-card adds (Jay\'s call)', () => {
  // The card is a gate, not an editor. New wants at the terminal 'complete' stage do NOT land — not a bare want,
  // and not even one the model re-records — because the earlier "add at the card" path was buggy (silent loss +
  // no room to answer). Wants are added later in Reconnect + the companion rail.
  const base = { athleticPast: 'a player', identityNoun: 'Player', gap: 'a real fade over a long hard decade', reclaimList: ['My fitness', 'See friends on weekends'] };
  // A bare want the model only acknowledged in prose → not captured, AND the reply never claims it was "Added".
  const bare = applyStagedTurn({ stage: 'complete', collected: { ...base } }, [], 'Buy a new road bike', { text: 'Added to the list. Any particular kind of bike in mind?' });
  assert.equal(bare.state.collected.reclaimList?.length, 2, 'a want stated at the card does not grow the list');
  assert.equal(bare.complete, true, 'the card stands (confirm-only)');
  assert.equal(/\badded\b/i.test(bare.reply), false, 'never falsely claims the want was added');
  assert.match(bare.reply, /set for now|first session/i, 'says the list is set + points to where adding works');
  // Even a model-RECORDED add is frozen out at the terminal — the list is set by here.
  const recorded = applyStagedTurn({ stage: 'complete', collected: { ...base } }, [], 'add running shoes', { text: 'Added.', record: { reclaimList: ['My fitness', 'See friends on weekends', 'running shoes'] } });
  assert.equal(recorded.state.collected.reclaimList?.length, 2, 'a model-recorded add is frozen out at the card');
});

// ── Decision II: the shape gate wired into the reclaim confirm (propose/confirm, never a silent rewrite) ──
const DII_BASE = { athleticPast: 'a player', identityNoun: 'Player', gap: 'a real fade over a long hard decade' };

test('gather hygiene (Elite Cyclist walk) — a "shape of it" close is not captured; an "N rides a week" cadence folds', () => {
  // "That's about the shape of it" is the member closing the list, not a want (RECLAIM_CLOSE_RE missed "shape of it").
  assert.equal(memberClosingReclaim("That's about the shape of it"), true);
  // "2-3 rides a week to begin with" is a cadence fragment — captured during the reclaim GATHER, it folds into its
  // parent want (Rule 4, generic activity noun) rather than standing alone.
  const s: ConvState = { stage: 'reclaim', collected: { athleticPast: 'x', identityNoun: 'Elite Cyclist', gap: 'a real fade over a long hard decade', reclaimList: ['Riding my bike'] } };
  const t = applyStagedTurn(s, [], '2-3 rides a week to begin with', { text: 'Noted.', record: { reclaimList: ['Riding my bike', '2-3 rides a week to begin with'] } });
  const list = t.state.collected.reclaimList ?? [];
  assert.equal(list.length, 1, 'the cadence folds into "Riding my bike", not a standalone item');
  assert.match(list[0]!, /Riding my bike.*rides a week/i);
});

test('Decision II — the shape gate is UNBYPASSABLE: even the forceProgress/runaway path surfaces a shape (Explorer walk)', () => {
  // The bug behind Jay's Explorer walk: the gate lived only in the reclaim CONFIRM handler, but the reclaim stage
  // also hands off to the survey via forceProgress (the stall/runaway backstop) — which skipped the gate, so a
  // duplicate reached the card. The gate now lives at the enterGrintaSurvey CHOKEPOINT, so no path bypasses it.
  const stalled: ConvState = {
    stage: 'reclaim', awaitingConfirm: false, idleTurns: 3, // a stall → forceProgress fires
    collected: { athleticPast: 'x', identityNoun: 'Explorer', gap: 'a real fade over a long hard decade', reclaimList: ['My fitness', 'Drop 40 lbs', 'Lose 40 lbs', 'Buy new clothes'] },
  };
  const t = applyStagedTurn(stalled, [], '...', { text: 'ok' });
  assert.equal(t.state.stage, 'reclaim', 'the runaway handoff is held back to resolve the shape, not advanced to the survey');
  assert.equal(t.state.pendingReclaimShape?.kind, 'overlap', 'the "drop/lose 40 lbs" duplicate is surfaced');
});

test('tidyGapProse — mechanics-only cleanup of a raw backstop gap (milie walk); leaves the member’s words alone', () => {
  // Fixes run-on/punctuation/capitalization mechanics WITHOUT changing words (governance: their own account).
  assert.equal(
    tidyGapProse('i took a job in data entry.it is the opposite of being creative . my knee hurts'),
    'I took a job in data entry. It is the opposite of being creative. My knee hurts.',
  );
  // No-op on already-clean prose (the model's set_gap path is never mangled).
  assert.equal(tidyGapProse('Already clean prose. It stays exactly as written.'), 'Already clean prose. It stays exactly as written.');
  // Does NOT invent/change words — a member typo/contraction stays theirs (only the model tidies deeper, via set_gap).
  assert.match(tidyGapProse('i cant run anymore'), /cant run/);
});

test('STAGED gap — a short dispute re-opens but NEVER wipes the gap or Doors (never drop what they gave)', () => {
  const atConfirm: ConvState = {
    stage: 'gap', awaitingConfirm: true,
    collected: { athleticPast: 'a cyclist', identityNoun: 'Athlete', gap: GAP_STORY, doors: ['aging_parents'] },
  };
  const turn = applyStagedTurn(atConfirm, [], 'no, that’s not quite right', { text: 'Okay.' });
  assert.equal(turn.state.stage, 'gap', 'stays in the gap stage on a dispute');
  assert.equal(turn.state.awaitingConfirm, false, 'clears the pending confirm');
  assert.equal(turn.state.collected.gap, GAP_STORY, 'KEEPS the gap (the card is the correction point, not a wipe)');
  assert.deepEqual(doorsKnown(turn.state.collected), ['aging_parents'], 'keeps the Doors too — a dispute is not a ruling on them');
  assert.match(turn.reply, /get this right|how it really went/i);
});

test('STAGED gap — "there’s more" APPENDS the next chapter + accumulates Doors across turns (no wipe, no loop)', () => {
  // Progressive revelation (rita): layoff captured, reflected; she says "there's more" and adds the parent-care
  // chapter. It must APPEND and pick up aging_parents — not wipe the layoff or loop the opening question.
  const atConfirm: ConvState = {
    stage: 'gap', awaitingConfirm: true,
    collected: { athleticPast: 'a leader', identitySkipped: true, gap: 'I was laid off after twelve years right before a promotion.', doors: ['career_cliff'] },
  };
  const history: ConvMessage[] = [
    { role: 'member', text: 'I was laid off after twelve years right before a promotion.' },
    { role: 'agent', text: 'reflected the layoff…' },
  ];
  const more = 'No, there’s more — around the same time my father went into a coma and I became his caregiver, and my mother got sick too.';
  const turn = applyStagedTurn(atConfirm, history, more, { text: 'Thank you for telling me the rest.' });
  assert.match(turn.state.collected.gap!, /laid off/, 'kept the layoff chapter');
  assert.match(turn.state.collected.gap!, /coma|caregiver/, 'appended the parent-care chapter');
  assert.ok(doorsKnown(turn.state.collected).includes('career_cliff'), 'kept career_cliff');
  assert.ok(doorsKnown(turn.state.collected).includes('aging_parents'), 'picked up aging_parents from the new chapter');
  assert.equal(turn.state.awaitingConfirm, false, 'DRAWS OUT the new chapter (v2.1: explore the thread, not an instant re-reflect)');
  assert.match(turn.reply, /\?\s*$/, 'ends on a question — keeps exploring, never a loop on the opening line');
});

test('STAGED gap — a terse fragment with a clear Door IS captured (never strand a terse member)', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a runner', identityNoun: 'Runner' } };
  // terse: the whole fade is "Knee. Then divorce." (19 chars — below the narrative floor) but it names a Door.
  const { turns } = replayStaged(
    [
      { member: 'Knee. Then divorce.', model: { text: 'That’s a lot to carry.' } }, // no set_gap tag → backstop
      { member: 'That’s it.', model: { text: 'Okay.' } }, // whole → reflect
    ],
    atGap,
  );
  assert.equal(turns[0]!.state.collected.gap, 'Knee. Then divorce.', 'captured the terse fragment via its Door signal');
  assert.ok(doorsKnown(turns[0]!.state.collected).includes('marriage'), 'divorce → The Marriage');
  assert.equal(turns[1]!.state.awaitingConfirm, true, 'reflects once whole — does not strand on the opening question');
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

// --- Phase 2.1: the engine acts on the model's replyIntent SIGNAL end-to-end ------------------------------
test('STAGED confirm — the model replyIntent drives the branch through the engine (signal over regex)', () => {
  const atGapConfirm: ConvState = { stage: 'gap', awaitingConfirm: true, collected: { athleticPast: 'a runner', identityNoun: 'Runner', gap: 'The caregiving years took it.', doors: ['aging_parents'] } };
  // model tags a bare "sure" as a DISPUTE → the engine reopens the gap (regex would have advanced).
  const disp = applyStagedTurn(atGapConfirm, [], 'sure', { text: 'Let me get it right.', replyIntent: 'dispute' });
  assert.equal(disp.state.awaitingConfirm ?? false, false, 'dispute signal reopens the beat');
  assert.match(disp.reply, /get this right|how it really went/i);
  // model tags a chapter-sounding message as DONE → the engine advances to reclaim (regex might read "addition").
  const done = applyStagedTurn(atGapConfirm, [], 'well, and there was the move too', { text: 'Okay.', replyIntent: 'done' });
  assert.equal(done.state.stage, 'reclaim', 'done signal advances even on an addition-sounding message');

  // THE RECLAIM HALF IS GONE (2026-08-22, widget-first). It asserted that the model's replyIntent drives the
  // reclaim confirm branch — 'more' reopens the gather, 'done' settles it. Neither exists: the stage has no
  // conversational confirm, so the model has no branch to drive. What settles the list is the member submitting
  // the builder, which is not a signal anyone can mis-tag.
  //
  // The GAP half above is the real subject of this test and is untouched — that is where signal-over-regex still
  // decides something.
});

test('STAGED gap→reclaim — a WARM bridge off the gap, not a cold pivot (Phase 2.3 / Cowork #5)', () => {
  const atGapConfirm: ConvState = { stage: 'gap', awaitingConfirm: true, collected: { athleticPast: 'a runner', identityNoun: 'Racer', gap: 'The caregiving years slowly took it.', doors: ['aging_parents'] } };
  const turn = applyStagedTurn(atGapConfirm, [], "that's the whole of it", { text: 'Okay.' });
  assert.equal(turn.state.stage, 'reclaim', 'advances into reclaim');
  assert.match(turn.reply, /carrying|been waiting|the turn/i, 'bridges FROM the weight of the gap');
  // INVERTED, same rule: the warm bridge no longer says "no wonder the Racer got quiet" — it says "that part of
  // you". The Identity may be named as what they are RECLAIMING; it may not stand in for them as the person who
  // lived it. The warmth is what the surrounding assertions protect, and it survives.
  assert.doesNotMatch(turn.reply, /the Racer/, 'never refers to the member in the third person by their Identity');
  assert.match(turn.reply, /that part of you/i, 'still lands on what went quiet — in the second person');
  assert.doesNotMatch(turn.reply, /Now, the good part/i, 'no cold pivot');
  assert.match(turn.reply, /want back|first thing/i, 'still opens the reclaim ask');
});

test('STAGED reclaim — the list stays CLEAN: drill fragments fold in, near-dups collapse (Jay walk: sloppy list)', () => {
  const atReclaim: ConvState = { stage: 'reclaim', collected: { athleticPast: 'a triathlete', identityNoun: 'Triathlete', gap: 'A bad divorce took the time and the fitness.' } };
  const { finalState } = replayStaged(
    [
      { member: 'My body, I need to lose about 50 lbs', model: { text: 'Good. What else?', record: { reclaimList: ['My body, I need to lose about 50 lbs'] } } },
      { member: 'Lose about 50 lbs', model: { text: 'Got it.', record: { reclaimList: ['Lose about 50 lbs'] } } }, // near-dup (subset) → collapses
      { member: 'Start walking every morning', model: { text: 'How often?', record: { reclaimList: ['Start walking every morning'] } } },
      { member: 'Every day', model: { text: 'Nice.', record: { reclaimList: ['Every day'] } } }, // bare cadence → folds in
      { member: 'Start riding my bike again, maybe an e-bike', model: { text: 'How often?', record: { reclaimList: ['Start riding my bike again, maybe an e-bike'] } } },
      { member: '2-3 times a week', model: { text: 'Good.', record: { reclaimList: ['2-3 times a week'] } } }, // bare cadence → folds in
    ],
    atReclaim,
  );
  const list = finalState.collected.reclaimList ?? [];
  assert.equal(list.filter((x) => /50 lbs/i.test(x)).length, 1, 'the 50-lbs want appears once (near-dup collapsed)');
  assert.ok(!list.some((x) => /^every day$/i.test(x.trim())), '"Every day" is not a standalone item');
  assert.ok(!list.some((x) => /^2-3 times a week$/i.test(x.trim())), '"2-3 times a week" is not a standalone item');
  assert.match(list.join(' | '), /walking every morning, Every day/i, 'the cadence folded into the walking want');
  assert.match(list.join(' | '), /bike.*, 2-3 times a week/i, 'the cadence folded into the bike want');
  assert.equal(list.length, 3, 'three clean wants, not seven sloppy fragments');
});

// ── RETIRED 2026-08-22 — these exercise the CONVERSATIONAL reclaim path, which no longer exists ──────────────
//
// Widget-first (docs/decisions/2026-08-22-reclaim-list-widget-first.md) removed the draw-out in front of the
// builder. There is no prose gather on this stage and no `awaitingConfirm` loop to bounce in: the frame is one
// engine turn, the builder is the only writer, and the recap is one question.
//
// KEPT AS SKIPPED RATHER THAN DELETED, because each one is a real bug's headstone — "That looks great" was
// captured as a want on Jay's own walk, and a change request used to complete the stage instead of reopening it.
// If a conversational path is ever reintroduced here, these are the failures it has to clear again.
test.skip('STAGED reclaim confirm — "That looks great" is NOT captured as a want (Jay walk); it completes', () => {
  const atConfirm: ConvState = { stage: 'reclaim', awaitingConfirm: true, collected: { athleticPast: 'a runner', identityNoun: 'Runner', gap: 'The caregiving years took it.', reclaimList: ['My running', '2-3 runs per week', 'a local 5k'] } };
  // No model signal → the positive-ack regex must catch it (not append the confirmation as a list item).
  const noSig = applyStagedTurn(atConfirm, [], 'That looks great', { text: 'Great.' });
  assertHandsToGrinta(noSig); // a positive confirmation settles Reclaim → the survey
  assert.equal(noSig.state.collected.reclaimList?.length, 3, 'the confirmation is NOT appended as a want');
  // With the model's 'done' signal → the intent guard skips the late-add too.
  const sig = applyStagedTurn(atConfirm, [], 'That looks great', { text: 'Great.', replyIntent: 'done' });
  assertHandsToGrinta(sig);
  assert.equal(sig.state.collected.reclaimList?.length, 3, 'no want captured on a done signal');
});

// --- slice c: the RECLAIM stage + end-to-end --------------------------------------------------------
test.skip('STAGED reclaim confirm — an explicit CHANGE request reopens the gather (not everything is done)', () => {
  const atConfirm: ConvState = {
    stage: 'reclaim',
    awaitingConfirm: true,
    collected: { athleticPast: 'a cyclist', identityNoun: 'Competitor', gap: 'The grind crowded him out.', reclaimList: ['Ride my bike 3x a week', 'Weekend hiking trips'] },
  };
  const turn = applyStagedTurn(atConfirm, [], 'no, take the hiking one off — I meant something else', { text: 'Okay.' });
  assert.equal(turn.complete ?? false, false, 'a real change request does not complete');
  assert.equal(turn.state.awaitingConfirm, false, 'reopens the gather');
});

test('STAGED reclaim — a REPHRASED want collapses to one (Jay walk: "Getting down to 190 lbs" / "Get down to 190 lbs")', () => {
  const atReclaim: ConvState = { stage: 'reclaim', collected: { athleticPast: 'a triathlete', identityNoun: 'Ironman Triathlete', gap: 'The grind and family slowly suffocated it over years.' } };
  const { finalState } = replayStaged(
    [
      { member: 'Getting down to 190 lbs', model: { text: 'Good. What else?', record: { reclaimList: ['Getting down to 190 lbs'] } } },
      { member: 'Get down to 190 lbs', model: { text: 'Got it. What else?', record: { reclaimList: ['Get down to 190 lbs'] } } }, // same want, "get" vs "getting"
      { member: 'Get back on my bike 3-4 days a week', model: { text: 'Nice.', record: { reclaimList: ['Get back on my bike 3-4 days a week'] } } },
    ],
    atReclaim,
  );
  const list = finalState.collected.reclaimList ?? [];
  assert.equal(list.filter((x) => /190/.test(x)).length, 1, 'the 190 lbs want appears once — the content-token key catches the rephrase');
  assert.equal(list.length, 2, 'two distinct wants, no near-dup');
});

test('STAGED reclaim — light-touch sharpening REPLACES a vague want in place, never duplicates (measurable list)', () => {
  const atReclaim: ConvState = { stage: 'reclaim', collected: { athleticPast: 'a cyclist', identityNoun: 'Player', gap: 'The grind took it over the years.' } };
  const { finalState } = replayStaged(
    [
      { member: 'Ride my bike more', model: { text: 'What would that look like — a couple rides a week?', record: { reclaimList: ['Ride my bike more'] } } },
      { member: 'Yeah, like 3 times a week', model: { text: 'Got it. What else comes to mind?', refineReclaim: 'Ride my bike 3 times a week' } },
      { member: 'Lose 25 lbs', model: { text: 'Good. Anything else?', record: { reclaimList: ['Lose 25 lbs'] } } },
    ],
    atReclaim,
  );
  const list = finalState.collected.reclaimList ?? [];
  assert.deepEqual(list, ['Ride my bike 3 times a week', 'Lose 25 lbs'], 'the vague want is sharpened in place — no "Ride my bike more" left, no duplicate');
});

test('STAGED reclaim — re-surfaces a parked front-loader item at stage entry (the trust moment)', () => {
  // Member parked "writing again" back in the identity stage; we enter reclaim by confirming the gap.
  const atGapConfirm: ConvState = {
    stage: 'gap', awaitingConfirm: true,
    collected: { athleticPast: 'a writer', identityNoun: 'Writer', gap: 'Work slowly took everything I had.', reclaimList: ['writing again'] },
  };
  const turn = applyStagedTurn(atGapConfirm, [], 'yes, that’s how it went', { text: 'Okay.' });
  assert.equal(turn.state.stage, 'reclaim', 'advanced into reclaim');
  assert.match(turn.reply, /earlier you said/i, 'reads the parked item back');
  assert.match(turn.reply, /writing again/, 'names the exact parked want — nothing dropped');
});

// --- Increment 2: the decline-vs-Acceptance fork (Decision E — supersedes the Jun-26 admit-at-floor) --------
test('STAGED fade gate — a genuinely-thriving no-fade optimizer is gracefully DECLINED (out of scope, never admitted)', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a founder', identitySkipped: true } };
  // Theo-shaped: no loss, only forward ambition — the no-deficit member we don't serve.
  const { turns } = replayStaged(
    [
      { member: 'Honestly nothing went wrong — I’m thriving and I just want to optimize and level up further', model: { text: 'It sounds like things are good.' } },
      { member: 'Right, no loss or drift here. I want to scale my startup and run a faster marathon', model: { text: 'Got it.' } },
    ],
    atGap,
  );
  const last = turns.at(-1)!;
  assert.equal(last.declined, true, 'genuinely thriving → gracefully declined');
  assert.equal(last.state.stage, 'declined', 'terminal off-ramp, not admitted into Reclaim');
  assert.equal(last.complete, false, 'a decline is not a completion');
  assert.match(last.reply, /door stays open|kind of distance|keep building/i, 'warm, honest, non-pathologizing decline');
  assert.ok(!last.state.collected.gap, 'no fabricated fade captured into their record');
});

test('STAGED fade gate — note_no_fade → DECLINE even over an incidentally-tagged prose "gap"', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a founder', identitySkipped: true } };
  const turn = applyStagedTurn(atGap, [], "There's no distance at all — career, marriage, kids are all genuinely great, I just want more.", {
    text: "Sounds like you're thriving.",
    record: { gap: 'career, marriage, kids all genuinely great' },
    noFade: true,
  });
  assert.equal(turn.declined, true, 'the model’s no-fade judgement declines, even with a prose gap tagged');
  assert.equal(turn.state.stage, 'declined');
  assert.equal(turn.complete, false);
});

test('STAGED fade gate — a RESIGNED member is admitted as a real Fade, and is NOT labelled', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a runner', identityNoun: 'Runner' } };
  // No dramatic event — the fade is the surrender itself. Decision E admits her. Since Decision C (2026-08-15)
  // she is admitted WITHOUT being tagged: resignation is an intake signal, not a Door. This is the case that
  // makes C worth doing — she gets in, and the product never tells her she surrendered.
  const resigned = 'Nothing really happened. I just got older, slowed down, and made peace with it — this is just who I am now, at my age.';
  const { turns } = replayStaged(
    [
      { member: resigned, model: { text: 'I hear that.', record: { gap: resigned } } },
      { member: 'that’s the whole of it', model: { text: 'Okay.' } },
    ],
    atGap,
  );
  assert.notEqual(turns.at(-1)!.declined, true, 'a resigned member is NOT declined');
  assert.equal(turns[0]!.state.stageScratch?.gap?.noFade ?? false, false, 'reclassified as a real Fade, not no-fade');
  assert.equal(doorsKnown(turns[0]!.state.collected).includes('acceptance' as never), false,
    'admitted on the resignation SIGNAL — never stamped with a surrender Door');
  assert.equal(turns[1]!.state.awaitingConfirm, true, 'proceeds to reflect-confirm like any real fade');
});

test('STAGED fade gate — does NOT misfire on a real fade that also mentions wanting more', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a runner', identityNoun: 'Runner' } };
  // Has a real loss AND forward language — the loss signal must win (isForwardAmbition is false when loss present).
  const story = 'After my divorce I lost myself and stopped running; now I want more from life again, to level up and feel alive.';
  const { turns } = replayStaged(
    [
      { member: story, model: { text: 'That makes sense.', record: { gap: story } } },
      { member: 'that’s the whole story', model: { text: 'Okay.' } }, // whole → reflect
    ],
    atGap,
  );
  assert.equal(turns[0]!.state.collected.gap, story, 'a real fade with forward language is still captured');
  assert.equal(turns[0]!.state.stageScratch?.gap?.noFade ?? false, false, 'not misread as no-fade');
  assert.equal(turns[1]!.state.awaitingConfirm, true, 'proceeds to reflect-confirm once the story is whole');
});


// DONNA, 2026-08-18 — the builder prefixes "• ", she typed her own "- " inside the field, and one strip left it.
// Two of her three Reclaim items reached production reading "- A creative role that covers the bills…", which is
// what her dashboard shows her and what the Companion quotes back for the rest of the program.
test('a builder submission strips the member\'s own list marker as well as the builder\'s', () => {
  const items = parseReclaimListSubmission(
    '• - A creative role that covers the bills each month\n• - Lose the 20 lbs and rebuild strength\n• Less day-to-day conflict',
  );
  assert.deepEqual(items, [
    'A creative role that covers the bills each month',
    'Lose the 20 lbs and rebuild strength',
    'Less day-to-day conflict',
  ]);
});

test('stripping is bounded — it removes scaffolding, never the member\'s words', () => {
  // A real want is never eaten: only leading markers go, and the text after them is untouched.
  assert.deepEqual(parseReclaimListSubmission('• 1. ride my bike again'), ['ride my bike again']);
  assert.deepEqual(parseReclaimListSubmission('• be 20-minutes-a-day consistent'), ['be 20-minutes-a-day consistent']);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// DONNA'S WALK, 2026-08-20 — the Door that was never hers, end to end.
//
// She onboarded on prod and her summary card asserted four Doors under "The Doors you came through that created
// your Fade". One of them, The Full House, described "marriage, young kids, everyone needing you" — over a story
// with no partner and no children in it. Our own matcher produced it from the words "providing" and "provider",
// which were about her JOB and her MONEY, and it then suppressed The Load-Bearer, the Door her story actually
// evidences. She had no way to see any of it happen: the tagging was silent and the card was the first mention.
//
// This fixture replays her real gap text through the staged engine and pins both halves of the repair — the
// matcher no longer invents the Door, and NOTHING reaches her record until she rules on what we heard.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

const DONNA_STORY = `Two years ago I lost my job. I lost my creative outlet, but I also lost my agency: people came to me for answers, for decisions, for creative problem solving. I felt good about providing high-quality work to my leaders and internal clients. And I felt good about the money — I was our family's sole financial provider. When the job went, our financial situation became dire. Around the same time, my dad got really sick and almost died.`;

test('DONNA · the Doors we hear are a PROPOSAL — her record stays empty until she rules', () => {
  const { turns } = replayStaged(
    [
      { member: DONNA_STORY, model: { text: 'What did that first year feel like?', record: { gap: DONNA_STORY } } },
      { member: 'It was all at once, really.', model: { text: 'Here is what I heard.', gapReady: true } },
    ],
    { stage: 'gap', collected: { athleticPast: 'a maker', identityNoun: 'Maker' } },
  );
  const atConfirm = turns[1]!;
  assert.equal(atConfirm.state.awaitingConfirm, true, 'the beat reflects and waits');
  assert.deepEqual(atConfirm.state.collected.doors ?? [], [], 'nothing has been asserted about her life');
  // The heart of it: she is SHOWN what we heard, by name, before any of it is true of her.
  const heard = (atConfirm.expects as { doorsHeard?: { slug: string }[] }).doorsHeard?.map((d) => d.slug) ?? [];
  assert.ok(heard.length > 0, 'and the Doors are put to her rather than filed');
  assert.equal(heard.includes('full_house'), false, 'the Door that was never hers is not even proposed now');
  assert.ok(heard.includes('load_bearer'), '"sole financial provider" is the load, and it survives to be offered');
});

test('DONNA · a Door she takes off never reaches her card', () => {
  // The limit case that the old assert-then-undo could not express. Even if a wrong Door IS proposed — the
  // matcher will always be imperfect — her ✕ is the last word, and the card renders her ruling, not our guess.
  const atConfirm: ConvState = {
    stage: 'gap',
    awaitingConfirm: true,
    collected: { identityNoun: 'Maker', gap: DONNA_STORY, doorsProposed: ['career_cliff', 'full_house', 'load_bearer'] },
  };
  const t = applyStagedTurn(atConfirm, [], serializeGapConfirmChoice('done', ['career_cliff', 'load_bearer']), { text: '' });
  assert.deepEqual(t.state.collected.doors, ['career_cliff', 'load_bearer'], 'her ruling is the record');
  assert.deepEqual(t.state.collected.doorsProposed, [], 'and nothing is left pending to leak into the card later');
});

test('DONNA · a Door tagged AFTER the gate cannot assert itself — the card is not a back door', () => {
  // note_door is offered to the model on EVERY turn, so it can fire during the Reclaim List or the survey, long
  // after the one gate where she can rule. That tag has no path to a ruling, so it is discarded rather than
  // parked: keeping an assertion we can never ask her about is how it ends up quietly used by a later reader.
  // Nothing of HERS is lost — her gap story is kept whole, and R2's board re-derives from her record.
  const past: ConvState = {
    stage: 'reclaim',
    collected: { identityNoun: 'Maker', gap: DONNA_STORY, doors: ['career_cliff'] },
  };
  const t = applyStagedTurn(past, [], 'I want to get back to making things', { text: 'Tell me more.', record: { doors: ['full_house'] } });
  assert.deepEqual(t.state.collected.doors, ['career_cliff'], 'her confirmed set is untouched by a late tag');
  assert.deepEqual(t.state.collected.doorsProposed ?? [], [], 'and the late tag never becomes a pending assertion');
});

test('DONNA · a stuck member exits the gap holding NO Doors, never unruled ones', () => {
  // The anti-loop exits (forceProgress on a stall, the dispute/addition bounce ceilings) leave the gap stage
  // WITHOUT reaching the confirm. They used to carry every silently-tagged Door onto her card. Now the proposal
  // is dropped: no Doors is honest and recoverable at R2, a wrong Door is neither.
  const s: ConvState = {
    stage: 'gap',
    awaitingConfirm: true,
    stageScratch: { gap: { confirmBounces: 9 } },
    collected: { identityNoun: 'Maker', gap: DONNA_STORY, doorsProposed: ['full_house'] },
  };
  const t = applyStagedTurn(s, [], 'no, that’s not it either', { text: 'Okay.' });
  assert.equal(t.state.stage, 'reclaim', 'the ceiling moves her on rather than ping-ponging');
  assert.deepEqual(t.state.collected.doors ?? [], [], 'nothing she never ruled on reaches her record');
  assert.deepEqual(t.state.collected.doorsProposed ?? [], [], 'and the proposal does not linger to leak later');
});

test('DONNA · a late tag cannot fake progress — the stall detector still sees a drifting member', () => {
  // The subtle half of dropping late tags. If they merged and were swept downstream instead, `grew` would compare
  // this turn's Doors against last turn's WIPED set and read a re-tag as fresh progress every single turn — which
  // silently disables the runaway backstop for exactly the member who needs it. Found on a live persona walk.
  let state: ConvState = { stage: 'reclaim', collected: { identityNoun: 'Maker', gap: DONNA_STORY, doors: ['career_cliff'] } };
  const idle: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t = applyStagedTurn(state, [], 'mm', { text: 'Say more?', record: { doors: ['full_house'] } });
    idle.push(t.state.idleTurns ?? 0);
    state = t.state;
  }
  assert.deepEqual(idle, [1, 2, 3], 'a deflecting member accrues idle turns even while the model keeps tagging Doors');
});
