import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn } from '../lib/agent/onboarding-staged.ts';
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
