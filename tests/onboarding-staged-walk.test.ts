import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
import { detectCrisis } from '../lib/agent/governance.ts';
import type { ConvState, ConvMessage, ModelTurn, Turn } from '../lib/agent/onboarding.ts';

// ============================================================================
// STAGED ONBOARDING FULL-WALK HARNESS  (v3.2.1 stabilization safety net)
//
// The existing tests/onboarding-replay.test.ts drives applyModelTurn — the OLD v1 engine. PROD runs the STAGED
// engine (applyStagedTurn). That engine had NO end-to-end coverage, which is how the fade-gate cluster (CAT-01..06)
// sat live for weeks. This harness replays a scripted persona through applyStagedTurn offline (no API) so every
// stabilization fix lands with a walk that can't silently regress. A step = the member's message + the ModelTurn the
// model would emit that turn ({text, record?, noFade?, gapReady?, identityCandidates?, ...}).
// ============================================================================

type Step = { member: string; model: ModelTurn };

function replayStaged(steps: Step[], from: ConvState) {
  let state = from;
  const history: ConvMessage[] = [];
  const turns: Turn[] = [];
  for (const step of steps) {
    const turn = applyStagedTurn(state, history, step.member, step.model);
    turns.push(turn);
    history.push({ role: 'member', text: step.member }, { role: 'agent', text: turn.reply });
    state = turn.state;
    if (turn.complete || turn.declined) break; // terminal — client hands off (card) or shows the decline
  }
  return { turns, finalState: state, history, last: turns[turns.length - 1]! };
}

// A member who has finished the identity stage (named "the Athlete") and is now in the gap stage — the exact point
// the live Athlete walk was at when it misfired. Lets the fade-gate fixtures focus on the gap→decline decision.
const atGap = (): ConvState => ({
  stage: 'gap',
  collected: { athleticPast: 'Out and about, on top of my game — golf, riding, traveling with friends', identityNoun: 'Athlete' },
});

// ---------------------------------------------------------------------------
// CLUSTER 1 — the fade/scope gate. These assert CORRECT behavior; some FAIL today (bug reproduced), and turn green
// when the gate is redesigned. The gate must admit a real fade AND still decline a genuine no-fade optimizer.
// ---------------------------------------------------------------------------

test('GATE/CAT-01 — a Doors-accumulation fade (marriage→kids→work, no loss-verbs) must NOT be declined', () => {
  // The live Athlete walk: an ordinary accumulation fade, upbeat phrasing, no "loss words". The model even records the
  // Doors — yet the gate declines because hasGenuineLoss() ignores the committed Doors. This is the exact demographic
  // G4L exists for, turned away at the front door.
  const { finalState, last } = replayStaged(
    [
      { member: 'I got married', model: { text: 'Marriage — a whole new chapter.', record: { doors: ['marriage'] } } },
      { member: "It started soon after, I didn't have that ultimate freedom anymore", model: { text: 'That freedom mattered.' } },
      { member: 'Having kids really shifted my priorities', model: { text: 'Kids reshape everything.', record: { doors: ['full_house'] } } },
      // The misjudgement: on an upbeat "bigger job" answer the model tags note_no_fade. The engine must OVERRIDE this —
      // three Doors are on the table; this is plainly a real fade.
      { member: 'Work started ramping up too. Bigger job, more hours', model: { text: 'The job grew.', record: { doors: ['grind'] }, noFade: true } },
    ],
    atGap(),
  );
  assert.notEqual(finalState.stage, 'declined', 'a real Doors-accumulation fade was wrongly DECLINED (CAT-01)');
  assert.notEqual(last.declined, true, 'the member was turned away at the front door despite three named Doors');
});

test('GATE/CAT-03 — a genuinely thriving no-fade optimizer must STILL be declined (guard cuts both ways)', () => {
  // The other direction: no loss, no Doors, pure forward optimizer. This one SHOULD decline — the fix for CAT-01 must
  // not over-correct into admitting everyone and fabricating a fade.
  const { finalState, last } = replayStaged(
    [
      { member: 'Honestly nothing went wrong — great marriage, career I love, kids are thriving', model: { text: 'That is a good place to be.' } },
      { member: "I'm not carrying any loss, I just want to level up and take on a bigger challenge", model: { text: 'Reaching forward.', noFade: true } },
      { member: 'Yeah, no drift, no distance — I feel great, I just want more', model: { text: 'Understood.', noFade: true } },
    ],
    atGap(),
  );
  assert.equal(finalState.stage === 'declined' || last.declined === true, true, 'a genuine no-fade optimizer was wrongly ADMITTED — a fabricated fade (CAT-03)');
});

test('GATE/CAT-04 — one note_no_fade misfire must not permanently strand a genuine-loss member', () => {
  // The model mis-tags note_no_fade once, then the member tells a real loss story. The sticky flag must be reconciled:
  // the loss story must still be captured and the member must progress — never a dead loop that drops their story.
  const { finalState } = replayStaged(
    [
      { member: 'I guess things are just different now', model: { text: 'Tell me more.', noFade: true } },
      {
        member:
          'My dad died a couple years ago and I became the full-time caregiver for my mom while holding down my job, and somewhere in all of it I completely lost myself and stopped being the person I used to be',
        model: { text: 'That is a heavy loss to carry.' },
      },
    ],
    atGap(),
  );
  assert.equal(finalState.stage !== 'declined', true, 'a genuine-loss member was declined after a note_no_fade misfire (CAT-04)');
  assert.equal(!!finalState.collected.gap, true, 'the loss story was never captured — the sticky no-fade flag blocked it (CAT-04)');
});

// ---------------------------------------------------------------------------
// CLUSTER 2 — completion contract + structured reclaim capture.
// ---------------------------------------------------------------------------
const atReclaim = (): ConvState => ({
  stage: 'reclaim',
  collected: { athleticPast: 'a runner', identityNoun: 'Runner', gap: 'The years quietly took it, one reasonable choice at a time.' },
});

test('RECLAIM/CAT-14 — a below-floor list (< min) does NOT advance; it holds and re-shows the builder', () => {
  const t = applyStagedTurn(atReclaim(), [], '• Run a 5k\n• Sleep well', { text: '' }); // only 2, floor is 3
  assert.equal(t.state.stage, 'reclaim', 'must not advance to Grinta below the frozen ≥3 floor');
  assert.equal(t.expects?.kind, 'reclaim_list', 're-shows the builder seeded with what they have');
  assert.equal(t.complete, false);
});

test('RECLAIM/CAT-15 — deliberate near-duplicate entries are kept VERBATIM (not fuzzy-folded)', () => {
  // "ride my bike" + "ride my bike a couple times a week" is a token-subset the conversational appendReclaim folds/drops.
  const t = applyStagedTurn(atReclaim(), [], '• ride my bike\n• ride my bike a couple times a week\n• see my friends', { text: '' });
  assert.deepEqual(t.state.collected.reclaimList, ['ride my bike', 'ride my bike a couple times a week', 'see my friends']);
  assert.equal(t.state.stage, 'grinta', 'a valid ≥3 list advances');
});

test('RECLAIM/CAT-16/17 — the submission is authoritative: model phantom/refine pollution is discarded, categories stay in lockstep', () => {
  const t = applyStagedTurn(atReclaim(), [], '• Golf again\n• Lose 20 lbs\n• Call my brother', {
    text: '',
    record: { reclaimList: ['PHANTOM WANT'] }, // model add_reclaim_item phantom
    refineReclaim: 'CLOBBERED', // model refine
  });
  assert.deepEqual(t.state.collected.reclaimList, ['Golf again', 'Lose 20 lbs', 'Call my brother'], 'no phantom, no clobber');
  assert.equal(t.state.collected.reclaimCategories?.length, t.state.collected.reclaimList?.length, 'parallel arrays index-locked (CAT-17)');
});

// ---------------------------------------------------------------------------
// CLUSTER 4 — crisis lexicon + declined-resume.
// ---------------------------------------------------------------------------
test('CRISIS/CAT-22 — explicit self-harm / overdose / planning phrasings all route to crisis', () => {
  for (const s of ['I keep cutting myself', 'I want to overdose', 'I made a plan to end it', 'thinking about taking all my pills']) {
    assert.equal(detectCrisis(s).flagged, true, `must flag: "${s}"`);
  }
  assert.equal(detectCrisis('I want to cut back on drinking').flagged, false, 'ordinary "cut back" does not false-fire');
});

test('DECLINE/CAT-26 — a declined session stays terminal on resume; never dragged into a completion', () => {
  const declined: ConvState = { stage: 'declined', collected: {} };
  const t = applyStagedTurn(declined, [], 'actually wait', { text: '' });
  assert.equal(t.declined, true, 're-asserts the decline');
  assert.equal(t.complete, false, 'never force-completes an empty declined session');
});

// ---------------------------------------------------------------------------
// JAY'S CYCLIST WALK (2026-07-29) — the model tagged a clear CLOSE as 'more', so the engine held in the gap stage
// while the model, believing it had moved on, ran the OLD conversational reclaim itself. The structured builder
// never fired. A close the member plainly stated must win over the model's contradicting guess.
// ---------------------------------------------------------------------------
test('GAP CONFIRM — a plain close ("that\'s the brunt of it") advances to the reclaim BUILDER even if the model says "more"', () => {
  const atGapConfirm = (): ConvState => ({
    stage: 'gap',
    awaitingConfirm: true,
    collected: {
      athleticPast: 'riding, out and about',
      identityNoun: 'Cyclist',
      gap: 'I got married, then kids, then the job grew and there was no room for the bike.',
      doors: ['marriage', 'full_house', 'grind'],
    },
  });
  const hist: ConvMessage[] = [{ role: 'agent', text: 'Does that land the way it happened — or is there more to it?' }];
  for (const replyIntent of [undefined, 'done' as const, 'more' as const]) {
    const t = applyStagedTurn(atGapConfirm(), hist, "That's the brunt of it", {
      text: "We're going to fix that. Now let's talk about what you want back.",
      ...(replyIntent ? { replyIntent } : {}),
    });
    assert.equal(t.state.stage, 'reclaim', `model replyIntent=${replyIntent}: must advance out of gap`);
    assert.equal(t.expects?.kind, 'reclaim_list', `model replyIntent=${replyIntent}: the structured builder must fire`);
  }
});

test('GAP CONFIRM — a genuine ADDITION still keeps drawing out (the corroboration gate is not a blanket override)', () => {
  const t = applyStagedTurn(
    { stage: 'gap', awaitingConfirm: true, collected: { athleticPast: 'riding', identityNoun: 'Cyclist', gap: 'The job grew.', doors: ['grind'] } },
    [{ role: 'agent', text: 'is there more to it?' }],
    'Actually yes — my father died that same year and I stopped riding altogether after that',
    { text: 'Thank you for telling me.', replyIntent: 'more' },
  );
  assert.equal(t.state.stage, 'gap', 'real new material still holds in the gap draw-out');
});

// ---------------------------------------------------------------------------
// CAT-31 — administered liveness. These stages return BEFORE the idle/runaway backstop, so an unreadable answer
// re-prompted the same item forever. We can't skip an item (frozen instrument) or invent a value — so the escape
// has to be made EXPLICIT rather than left silent.
// ---------------------------------------------------------------------------
test('ADMINISTERED/CAT-31 — repeated unreadable answers surface the way out (never a silent loop)', () => {
  let state: ConvState = { stage: 'grinta', collected: { athleticPast: 'a runner', identityNoun: 'Runner', gap: 'It faded.', reclaimList: ['a', 'b', 'c'] } };
  const hist: ConvMessage[] = [];
  const replies: string[] = [];
  for (let i = 0; i < 4; i++) {
    const t = applyStagedTurn(state, hist, 'I really do not know how to answer that', { text: '' });
    replies.push(t.reply);
    hist.push({ role: 'member', text: 'I really do not know how to answer that' }, { role: 'agent', text: t.reply });
    state = t.state;
  }
  assert.equal(state.stage, 'grinta', 'still holding the item — never fabricates a score to escape');
  assert.equal(/leave it and come back|place is saved/i.test(replies[0]!), false, 'the first miss is just a re-prompt');
  assert.equal(
    replies.some((r) => /leave it and come back/i.test(r) && /place is saved/i.test(r)),
    true,
    'after repeated misses the member is told how to answer AND that they can leave with their place kept',
  );
});

test('ADMINISTERED/CAT-31 — a readable answer clears the streak and advances normally', () => {
  const state: ConvState = { stage: 'grinta', collected: { athleticPast: 'a runner', identityNoun: 'Runner', gap: 'It faded.', reclaimList: ['a', 'b', 'c'] } };
  const t = applyStagedTurn(state, [], '4', { text: '' });
  assert.equal((t.state.administeredResponses ?? []).length, 1, 'the score records');
  assert.equal(/place is saved/i.test(t.reply), false, 'no stuck-help on a good answer');
});

// ---------------------------------------------------------------------------
// DECISION II — the shape gate's propose→ANSWER→resolve loop.
//
// Jennifer's live walk (2026-07-30) hit the gate's missing half: gateNextShape() posed a proposal and parked it on
// `pendingReclaimShape`, resolvePendingShape() knew how to apply her answer — but nothing called it. It was dead
// code. So her answer fell through to "append whatever they typed", the unresolved shape re-detected, and the
// proposal repeated VERBATIM. Then the item the engine had just appended overlapped the original, starting a
// SECOND loop the engine manufactured itself. She was stuck.
// ---------------------------------------------------------------------------
const JENNIFER_PARAGRAPH =
  'I want to get back in shape—toned, stronger for bone health and balance, and feeling confident in my own skin ' +
  'again.  I also want to get back to healthy eating—working toward NOT being an emotional eater.  I also want to ' +
  'get back to walking every day..';

test('SHAPE-GATE — answering a multi-want draw-out RESOLVES it: never re-asked, answer never appended as a new item', () => {
  const submitted = applyStagedTurn(
    atReclaim(),
    [],
    `• ${JENNIFER_PARAGRAPH}\n• Get back to reading\n• See my sister more`,
    { text: '' },
  );
  assert.match(submitted.reply, /Which one do you most want back/, 'the paragraph is caught as multi-want');
  assert.equal(submitted.state.stage, 'reclaim', 'held at reclaim — a sloppy list cannot reach the card');

  const hist: ConvMessage[] = [{ role: 'agent', text: submitted.reply }];
  const answered = applyStagedTurn(submitted.state, hist, 'Get back in shape and walking daily.', { text: '' });

  assert.doesNotMatch(answered.reply, /Which one do you most want back/, 'THE BUG: the proposal must not repeat');
  const list = answered.state.collected.reclaimList ?? [];
  assert.equal(list.includes(JENNIFER_PARAGRAPH), false, 'the paragraph is replaced by her distilled want');
  assert.equal(list.filter((i) => /get back in shape/i.test(i)).length, 1, 'her answer lands ONCE, not appended alongside');
  assert.equal(answered.state.stage, 'grinta', 'a now-clean list advances to the baseline survey');
});

test('SHAPE-GATE — "keep them as one" MERGES and moves on (the second loop Jennifer hit)', () => {
  const submitted = applyStagedTurn(
    atReclaim(),
    [],
    '• Get back in shape and walk daily\n• Get back in shape and walking daily\n• See my sister more',
    { text: '' },
  );
  assert.match(submitted.reply, /sound like the same thing to me/, 'the near-duplicate is caught as an overlap');

  const hist: ConvMessage[] = [{ role: 'agent', text: submitted.reply }];
  const answered = applyStagedTurn(submitted.state, hist, 'We can keep them as one.', { text: '' });

  assert.doesNotMatch(answered.reply, /sound like the same thing to me/, 'THE BUG: the merge question must not repeat');
  assert.equal((answered.state.collected.reclaimList ?? []).length, 2, 'the two became one');
  assert.equal(answered.state.stage, 'grinta', 'and she is through');
});

test('SHAPE-GATE — "they are different" keeps BOTH and still moves on (a want is never lost)', () => {
  const submitted = applyStagedTurn(
    atReclaim(),
    [],
    '• Get back in shape and walk daily\n• Get back in shape and walking daily\n• See my sister more',
    { text: '' },
  );
  const hist: ConvMessage[] = [{ role: 'agent', text: submitted.reply }];
  const answered = applyStagedTurn(submitted.state, hist, "No, they're different.", { text: '' });

  assert.equal((answered.state.collected.reclaimList ?? []).length, 3, 'nothing dropped on a "no"');
  assert.doesNotMatch(answered.reply, /sound like the same thing to me/, 'and it is never re-proposed');
  assert.equal(answered.state.stage, 'grinta');
});

test('SHAPE-GATE — a list with TWO shapes resolves them one at a time, then advances', () => {
  const submitted = applyStagedTurn(
    atReclaim(),
    [],
    `• ${JENNIFER_PARAGRAPH}\n• See my sister more\n• See my sister more often`,
    { text: '' },
  );
  // Overlap is reconciled before multi-want, so the near-duplicate sisters are proposed first.
  assert.match(submitted.reply, /sound like the same thing to me/);
  const hist: ConvMessage[] = [{ role: 'agent', text: submitted.reply }];
  const first = applyStagedTurn(submitted.state, hist, 'Keep them as one.', { text: '' });
  assert.equal(first.state.stage, 'reclaim', 'the SECOND shape now surfaces — still gated');
  assert.match(first.reply, /Which one do you most want back/, 'and it is a DIFFERENT question, not a repeat');

  hist.push({ role: 'agent', text: first.reply });
  const second = applyStagedTurn(first.state, hist, 'Get back in shape.', { text: '' });
  assert.equal(second.state.stage, 'grinta', 'both resolved → through to the survey');
  assert.doesNotMatch(second.reply, /Which one do you most want back|sound like the same thing/, 'neither is re-asked');
});
