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
  assert.match(turns[3]!.reply, /what happened to the Athlete|pulled you away from the Athlete/i, 'bridges from the named identity');
  assert.match(turns[3]!.reply, /Doors/, 'introduces Doors at first use');
  assert.equal(finalState.collected.identityNoun, 'Athlete');
});

test('STAGED identity→gap bridge (1b): skipped identity falls back to the standalone gap opener (no name to bridge)', () => {
  const { turns } = replayStaged([
    { member: 'I chased every new idea', model: { text: 'I hear that.', record: { athleticPast: 'someone who chased every new idea' } } },
    { member: 'I can’t name it yet', model: { text: 'That’s okay.', record: { identitySkipped: true } } },
  ]);
  // skip → SKIP_ACK + the standalone gapOpen (can't bridge from a name that was never given), still warm + Doors.
  assert.match(turns[1]!.reply, /find her through the work/i, 'acknowledges the skip');
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
  assert.ok((turns[0]!.state.collected.doors ?? []).length >= 2, 'Doors still captured');
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
  assert.deepEqual(turns[0]!.state.collected.doors, ['aging_parents'], 'Door tagged by the model is kept');
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
  const atConfirm: ConvState = { stage: 'gap', awaitingConfirm: true, gapDepth: 2, collected: { athleticPast: 'a runner', identityNoun: 'Runner', gap: 'The caregiving years took it.', doors: ['aging_parents'] } };
  for (const msg of ['yes, you’ve got it', 'exactly', 'yeah that’s right', 'that lands']) {
    const turn = applyStagedTurn(atConfirm, [], msg, { text: 'Okay.' });
    assert.equal(turn.state.stage, 'reclaim', `"${msg}" is a confirmation → advances to reclaim`);
  }
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
      { member: 'That’s the whole of it', model: { text: 'Thank you.' } }, // signals the story whole → reflect
      { member: 'Yes, you’ve got it', model: { text: 'Okay.' } }, // confirm → advance
    ],
    atGap,
  );
  // turn 1: gap captured + Door derived, but still RECEIVING (invites the rest before reflecting)
  assert.equal(turns[0]!.state.collected.gap, GAP_STORY);
  assert.deepEqual(turns[0]!.state.collected.doors, ['aging_parents'], 'Door tagged by the model is kept');
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
  assert.deepEqual(turns[1]!.state.collected.doors ?? [], [], 'no Door invented when none was described');
});

test('STAGED gap — backstop: model converses WITHOUT set_gap; engine captures the message in-stage', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a runner', identityNoun: 'Runner' } };
  // The most common real failure: the model reflects warmly but never calls the tool (record undefined).
  const story =
    'It was slow. I became the one caring for my aging mother — the role reversal where I was suddenly the ' +
    'parent to my own parent — and somewhere in those years I stopped being anyone but the person who showed up.';
  const { turns } = replayStaged(
    [
      { member: story, model: { text: 'That must have been so hard.' } },
      { member: 'That’s about it', model: { text: 'Okay.' } }, // whole → reflect
    ],
    atGap,
  );
  assert.equal(turns[0]!.state.collected.gap, story, 'backstop captured the member’s own gap message');
  assert.equal(turns[1]!.state.awaitingConfirm, true, 'reflects once whole — no loop on the opening question');
  assert.deepEqual(turns[1]!.state.collected.doors, ['aging_parents'], 'Door still derived from the captured gap');
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
  assert.equal(/most like yourself/i.test(turns[3]!.reply), false); // not looping the opening question
  assert.equal(turns[4]!.state.awaitingConfirm, true, 'and the stage advances to reflect-confirm when she signals whole');
});

test('STAGED — systemic gather-cap: a runaway gather loop is forced to the card once card-ready (no unbounded loop)', () => {
  // A verbose member (front-loader shape) whose data is all captured but who keeps elaborating, so no stage
  // ever recognizes "done". Past the turn budget, the engine must route to the card — not loop forever.
  const history: ConvMessage[] = [];
  for (let i = 0; i < 19; i++) history.push({ role: 'member', text: `elaboration ${i}` }, { role: 'agent', text: 'go on' });
  const cardReadyState: ConvState = {
    stage: 'reclaim',
    collected: {
      identityNoun: 'Performer',
      gap: 'A diagnosis ended touring, then the band dissolved, then a move wiped out the whole music community.',
      doors: ['diagnosis', 'vanishing'],
      reclaimList: ['play live again', 'write weekly', 'sleep normally'],
    },
  };
  // turn 20 (history has 19 prior member turns + this one), still "offering" but really just looping.
  const turn = applyStagedTurn(cardReadyState, history, 'and another thing I keep thinking about', { text: 'Mm.' });
  assert.equal(turn.complete, true, 'forced to the card past the budget — the loop is bounded');
  assert.equal(turn.state.stage, 'complete');
  assert.match(turn.reply, /look like you|captured/i);
});

test('STAGED — systemic gather-cap: a gap-elaboration loop is force-advanced to Reclaim (front-loader stall)', () => {
  // A verbose member with a real gap captured, but she keeps elaborating so the gap stage never advances and
  // reclaim stays 0. Past the budget, the engine must move her on to Reclaim, not loop "was there more?".
  const history: ConvMessage[] = [];
  for (let i = 0; i < 19; i++) history.push({ role: 'member', text: `more gap detail ${i}` }, { role: 'agent', text: 'go on' });
  const stuckInGap: ConvState = {
    stage: 'gap',
    collected: {
      identityNoun: 'Performer',
      gap: 'A vocal-cord diagnosis ended touring, then the band dissolved, then a move wiped out the music community.',
      doors: ['diagnosis', 'vanishing'],
    },
  };
  const turn = applyStagedTurn(stuckInGap, history, 'and one more thing about how it felt', { text: 'Mm.' });
  assert.equal(turn.state.stage, 'reclaim', 'force-advanced out of the gap-elaboration loop into Reclaim');
  assert.equal(turn.complete, false, 'not completed yet — she still names what she wants back');
  assert.match(turn.reply, /want back|reclaim/i);
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

test('STAGED reclaim — complete-when-done (run-6 fix): ≥3 items then a non-adding turn reflects, never loops', () => {
  // She has 3 items and then says something that adds NO new item and isn't an explicit "that's the list".
  // The engine must reflect (she's done offering), not loop "what else?" forever. Never force-closes — she
  // still confirms the card.
  const atReclaim: ConvState = {
    stage: 'reclaim',
    collected: {
      athleticPast: 'a runner', identityNoun: 'Runner', gap: 'a real fade over a long hard decade of putting everyone else first',
      reclaimList: ['running', 'sleep', 'seeing friends'],
    },
  };
  const turn = applyStagedTurn(atReclaim, [], 'hm, I’m not sure what else right now', { text: 'Okay.' });
  assert.equal(turn.state.collected.reclaimList?.length, 3, 'a non-item reply is not captured as an item');
  assert.equal(turn.state.awaitingConfirm, true, 'reflects the list once she stops adding — no infinite "what else?"');
  assert.equal(turn.complete, false, 'reflect is not completion — she still confirms the card (never force-closed)');
  assert.match(turn.reply, /want to reclaim/i);
});

test('STAGED reclaim — late-add (v2.1 fix): a want volunteered AT the confirm is captured, not dropped (Jay’s "play golf")', () => {
  // At the reclaim reflect-confirm ("anything missing?"), the member volunteers a NEW want. It must be captured
  // before advancing — the bug on Jay's walk dropped it. A bare affirmation still advances.
  const atConfirm: ConvState = {
    stage: 'reclaim', awaitingConfirm: true,
    collected: {
      athleticPast: 'x', identityNoun: 'Athlete', gap: 'a real fade over a long decade', doors: ['marriage'],
      reclaimList: ['work out more', 'see friends', 'ride my bike'], reclaimCategories: ['', '', ''],
    },
  };
  const added = applyStagedTurn(atConfirm, [], 'play golf on weekends', { text: 'Love it.' });
  assert.ok((added.state.collected.reclaimList ?? []).includes('play golf on weekends'), 'the volunteered want is captured, not dropped');
  assert.equal(added.state.awaitingConfirm, true, 're-reflects the fuller list — does not skip to the card');
  // a bare affirmation is NOT captured as a want — it advances to the card.
  const done = applyStagedTurn(atConfirm, [], 'yes, that’s it', { text: 'Great.' });
  assert.equal((done.state.collected.reclaimList ?? []).length, 3, 'an affirmation is not captured as a want');
  assert.equal(done.state.stage, 'complete', 'affirmation advances to the card');
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
  for (const t of turns) assert.equal(/most like yourself/i.test(t.reply), false, 'never loops the opening question');
  assert.match(turns[0]!.reply, /more|heart of/i, 'still a real "is there more?" gather prompt');
});

test('STAGED — general no-verbatim-repeat guard: a static opener/nudge is never emitted twice in a row', () => {
  // The eval's repeat-detector caught STAGED_OPENING (identity) and gapOpen re-emitting verbatim when a member
  // stalls. The engine-level guard must vary ANY line that would equal the last agent reply.
  const opener = stagedOpening().reply;
  const t = applyStagedTurn({ stage: 'identity', collected: {} }, [{ role: 'agent', text: opener }], 'hmm, not sure', { text: 'Mm.' });
  assert.notEqual(t.reply, opener, 'does not repeat the opener verbatim');
  assert.match(t.reply, /most like yourself/i, 'still carries the identity prompt (varied, not lost)');
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
  assert.deepEqual(turn.state.collected.doors, ['aging_parents'], 'keeps the Doors too');
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
  assert.ok(turn.state.collected.doors!.includes('career_cliff'), 'kept career_cliff');
  assert.ok(turn.state.collected.doors!.includes('aging_parents'), 'picked up aging_parents from the new chapter');
  assert.equal(turn.state.awaitingConfirm, true, 're-reflects the fuller story — no loop on the opening question');
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
  assert.ok(turns[0]!.state.collected.doors!.includes('marriage'), 'divorce → The Marriage');
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
  assert.match(turns[3]!.reply, /want to reclaim/i);
  assert.match(turns[3]!.reply, /riding again/);
  // confirm → complete + handoff to the card
  assert.equal(finalState.stage, 'complete');
  assert.equal(turns[4]!.complete, true, 'completes — the card renders from collected');
  assert.equal(finalState.collected.reclaimList?.length, 3);
  assert.match(turns[4]!.reply, /captured|look like you/i);
});

test('STAGED reclaim — a want captured twice lands ONCE (Jay walk: "Ride my bike more" ×2 on the card)', () => {
  const atReclaim: ConvState = { stage: 'reclaim', collected: { athleticPast: 'a cyclist', identityNoun: 'Player', gap: 'The grind slowly took it over fifteen years.' } };
  const { finalState } = replayStaged(
    [
      { member: 'Ride my bike more', model: { text: 'Got it. What else comes to mind?', record: { reclaimList: ['Ride my bike more'] } } },
      { member: 'Lose 25 lbs', model: { text: 'Good. Anything else?', record: { reclaimList: ['Lose 25 lbs'] } } },
      { member: 'Ride my bike more', model: { text: 'Yes.', record: { reclaimList: ['Ride my bike more'] } } }, // model re-tags an identical want
      { member: 'spend more time with friends and travel', model: { text: 'Got it.', record: {} } }, // model under-tags → backstop captures once
    ],
    atReclaim,
  );
  const list = finalState.collected.reclaimList ?? [];
  assert.equal(list.filter((x) => /^ride my bike more$/i.test(x.trim())).length, 1, 'the re-said want is deduped — no second "Ride my bike more"');
  assert.ok(list.some((x) => /friends and travel/i.test(x)), 'the backstop-captured want still lands');
  assert.equal(list.length, 3, 'three distinct wants — no duplicate on the card');
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

test('STAGED reclaim — soft-close phrases are NOT captured as wants (Jay walk: "Pretty solid start" / "sums it up")', () => {
  const base: ConvState = {
    stage: 'reclaim',
    collected: { athleticPast: 'a cyclist', identityNoun: 'Player', gap: 'The grind took it over the years.', reclaimList: ['My body, lose 25 lbs', 'Ride my bike more', 'Travel on weekends with friends'] },
  };
  // gather turn: an acknowledgement of the reflection, not a want → not captured; at ≥min it reflects the list.
  const t1 = applyStagedTurn(base, [], 'Pretty solid start', { text: 'Okay.' });
  assert.ok(!(t1.state.collected.reclaimList ?? []).some((x) => /solid start/i.test(x)), '"Pretty solid start" is not a want');
  assert.equal(t1.state.awaitingConfirm, true, 'a soft close at ≥min reflects the list, does not add an item');
  // at the confirm: "That about sums it up for now" advances to the card — never captured as another list item.
  const t2 = applyStagedTurn({ ...base, awaitingConfirm: true }, [], 'That about sums it up for now', { text: 'Okay.' });
  assert.ok(!(t2.state.collected.reclaimList ?? []).some((x) => /sums it up/i.test(x)), '"That about sums it up" is not a want');
  assert.equal(t2.state.stage, 'complete', 'the close advances to the card');
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

test('STAGED fade gate — RESIGNED (Acceptance) is NOT declined: routes to The Acceptance Door as a real Fade', () => {
  const atGap: ConvState = { stage: 'gap', collected: { athleticPast: 'a runner', identityNoun: 'Runner' } };
  // No dramatic event — the fade is the surrender itself. Decision E: a REAL Fade, entered through The Acceptance.
  const resigned = 'Nothing really happened. I just got older, slowed down, and made peace with it — this is just who I am now, at my age.';
  const { turns } = replayStaged(
    [
      { member: resigned, model: { text: 'I hear that.', record: { gap: resigned } } },
      { member: 'that’s the whole of it', model: { text: 'Okay.' } },
    ],
    atGap,
  );
  assert.notEqual(turns.at(-1)!.declined, true, 'a resigned member is NOT declined');
  assert.equal(turns[0]!.state.noFade ?? false, false, 'reclassified as a real Fade, not no-fade');
  assert.ok((turns[0]!.state.collected.doors ?? []).includes('acceptance'), 'routed to The Acceptance Door');
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
  assert.equal(turns[0]!.state.noFade ?? false, false, 'not misread as no-fade');
  assert.equal(turns[1]!.state.awaitingConfirm, true, 'proceeds to reflect-confirm once the story is whole');
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
  assert.match(turns[2]!.reply, /want to reclaim/i, 'accepts the sub-3 list and reflects (never fabricates a 3rd)');
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
    { member: 'I was a competitive swimmer — up at 5am every day for the pool, the black line the one place my mind ever went quiet, and I felt unbreakable out there', model: { text: 'That dedication shows.', record: { athleticPast: 'a competitive swimmer, up at 5am every day for the pool, the black line the one place her mind went quiet, felt unbreakable out there' } } },
    { member: 'The Swimmer', model: { text: 'The Swimmer.', record: { identityNoun: 'Swimmer' } } },
    { member: 'yes that’s right', model: { text: 'Good.' } },
    { member: 'After my divorce I just stopped. The early mornings went, then everything else, and I never found my way back to the water or to myself.', model: { text: 'When did you first feel yourself slipping from the water?', record: { gap: 'After my divorce I stopped — the early mornings went, then everything else, and I never found my way back to the water or to myself.', doors: ['marriage'] } } },
    { member: 'Within a year the pool felt like someone else’s life — really I’d lost the person who got up for it.', model: { text: 'That’s the quiet cost of it — losing the one who got up for it.', record: { gap: 'After my divorce I stopped swimming; within a year the pool felt like someone else’s life, and I’d lost the person who got up for it.' }, gapReady: true } },
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
