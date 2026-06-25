import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyModelTurn,
  INITIAL_STATE,
  type ConvState,
  type ConvMessage,
  type ModelTurn,
  type Turn,
} from '../lib/agent/onboarding.ts';
import { contractMet } from '../lib/agent/onboarding-contract.ts';

// ============================================================================
// ONBOARDING REPLAY HARNESS
//
// The live loop (liveTurn) is the least-testable, highest-risk code (CLAUDE.md). We extracted every
// DECISION into the pure `applyModelTurn`, so we can now replay a recorded transcript through the engine
// offline — no API — and assert how it behaves. A "fixture" is a sequence of turns, each carrying the
// member's message and the MODEL's turn that turn (its prose + the record_progress it emitted, or NONE
// when the model conversed without recording — the exact failure that stranded Donna). This turns
// "a human finds it in prod" into "CI catches it." Real stalled runs become permanent regression fixtures.
// ============================================================================

type Step = { member: string; model: ModelTurn };

function replay(steps: Step[], from: ConvState = INITIAL_STATE) {
  let state = from;
  const history: ConvMessage[] = [];
  const turns: Turn[] = [];
  for (const step of steps) {
    const turn = applyModelTurn(state, history, step.member, step.model);
    turns.push(turn);
    history.push({ role: 'member', text: step.member }, { role: 'agent', text: turn.reply });
    state = turn.state;
    if (turn.complete) break; // mirror reality: once complete, the client hands off to the IDQ — no more turns
  }
  return { turns, finalState: state, history };
}

// Invariants every healthy run must hold — asserted on top of any fixture.
function assertInvariants(turns: Turn[]) {
  const agentReplies = turns.map((t) => t.reply.trim());
  // 1) The engine NEVER repeats its own previous message verbatim (the "you're hung up" loop).
  for (let i = 1; i < agentReplies.length; i++) {
    assert.notEqual(agentReplies[i], agentReplies[i - 1], `turn ${i}: agent repeated itself verbatim`);
  }
  // 2) Completion is never claimed on an unmet contract (recognition is mandatory).
  for (const t of turns) {
    if (t.complete) assert.equal(contractMet(t.state.collected), true, 'completed with an unmet contract');
  }
  // 3) Every non-final reply invites a next step (never strands the member) — a question mark, the
  //    handoff phrases, or a warm imperative invitation ("Tell me …", as the slowed-down Door prompt uses).
  for (const t of turns.slice(0, -1)) {
    if (!t.complete) assert.match(t.reply, /\?|ready when you are|that’s everything|that's everything|tell me/i, 'a non-final turn left the member with no next step');
  }
}

// A member who's reached the Door beat (identity named, Reclaim List in) — the shape Donna was in.
const atDoorBeat: ConvState = {
  stage: 'door',
  collected: {
    athleticPast: 'Optimistic, energetic, creative — the one who lifts everyone up',
    identityNoun: 'Cheerleader',
    reclaimList: ['Reach out to friends regularly', 'Stop worrying about finances', 'A meaningful creative role'],
  },
};

const donnaGap =
  'Seven years ago my husband lost his job and semi-retired without a conversation; I became the sole ' +
  'financial support, carrying the household and the debt while managing his volatility. When I lost my ' +
  'own job he didn’t step up, and the affection disappeared. Around the same time my father went into a ' +
  'coma and I watched my mother decline — and the Cheerleader got buried in survival mode.';

test('REPLAY — Donna run 2: model reflects but never records the gap, then goes quiet; engine must NOT loop', () => {
  // The recorded failure: the model CONVERSES (warm reflections) but its record_progress never carries
  // the gap, then degrades to empty turns. Before the fix this re-asked the identical question 4×.
  const { turns, finalState } = replay(
    [
      // She tells her whole fade. Model reflects warmly — but records NOTHING (record: undefined).
      { member: donnaGap, model: { text: 'Thank you for trusting me with all of that. Seven years of carrying it alone.' } },
      // Degraded turn (API wobble): empty model output.
      { member: 'it seems like you are hung up', model: { text: '' } },
      // Another empty turn.
      { member: 'What’s next?', model: { text: '' } },
      // She explicitly asks to advance.
      { member: 'Can you move me through to the IDQ?', model: { text: '' } },
    ],
    atDoorBeat,
  );
  assertInvariants(turns);

  // The engine captured her story as the gap even though the model never recorded it.
  assert.ok(finalState.collected.gap && finalState.collected.gap.length > 80, 'gap captured from her own words');
  // No turn re-emitted the canned door prompt verbatim.
  for (const t of turns) assert.doesNotMatch(t.reply, /One more thing before we start the work/i, 'verbatim door prompt re-asked');
  // She completes on her explicit "move me through to the IDQ" — the contract is met via the captured gap.
  assert.equal(turns[turns.length - 1]!.complete, true, 'Donna completes once she asks to proceed');
  assert.equal(contractMet(finalState.collected), true);
});

test('REPLAY — Donna run 2: had the model recorded the gap properly, she still completes cleanly', () => {
  // The non-degraded version of the same run — proves the happy path isn't accidentally broken.
  const { turns, finalState } = replay(
    [
      { member: donnaGap, model: { text: 'That’s a lot to carry. Let me make sure I have it.', record: { gap: donnaGap, doors: ['load_bearer', 'aging_parents'] } } },
      { member: 'Yes, that’s the whole of it.', model: { text: 'Here’s what we’ve got — the weight you carried, and the Cheerleader we’re bringing back. Ready when you are.', record: { complete: true } } },
    ],
    atDoorBeat,
  );
  assertInvariants(turns);
  assert.equal(turns[turns.length - 1]!.complete, true);
  assert.deepEqual(finalState.collected.doors, ['aging_parents', 'load_bearer']); // canonical order
});

test('REPLAY — full happy path from scratch (identity → reclaim → door → complete)', () => {
  const { turns, finalState } = replay([
    { member: 'I was a competitive cyclist who rode every weekend', model: { text: 'That comes through clearly.', record: { athleticPast: 'a competitive cyclist who rode every weekend' } } },
    { member: 'The Athlete', model: { text: 'The Athlete it is.', record: { identityNoun: 'Athlete' } } },
    { member: 'ride again, sleep well, coach a friend', model: { text: 'A real list.', record: { reclaimList: ['ride again', 'sleep well', 'coach a friend'] } } },
    { member: 'my role was cut and the riding quietly stopped', model: { text: 'That’s the Career Cliff.', record: { gap: 'my role was cut and the riding quietly stopped', doors: ['career_cliff'] } } },
    { member: 'that’s everything', model: { text: 'Okay — the Career Cliff is how it started, and the Athlete is who we’re bringing back. Ready when you are.', record: { complete: true } } },
  ]);
  assertInvariants(turns);
  assert.equal(turns[turns.length - 1]!.complete, true);
  assert.equal(finalState.collected.identityNoun, 'Athlete');
  assert.deepEqual(finalState.collected.doors, ['career_cliff']);
  assert.equal((finalState.collected.reclaimList ?? []).length, 3);
  // The beat breathed: a thin single-Door gap did NOT complete on the turn it was given.
  assert.equal(turns[3]!.complete, false, 'thin gap explores before closing');
});

test('REPLAY — Donna at the Reclaim List (win-list): model reflects her items but records NONE, then she pushes; engine must NOT loop the prompt or strand her', () => {
  // The reported dead-end (Donna, member run-through): at the "what do you want back?" win-list step the
  // model CONVERSES (warm reflections) but its record_progress carries no reclaimList, so the beat can't
  // advance. The engine must never re-emit the win-list prompt verbatim and never leave a turn without a
  // next step; once the list is actually recorded it must move OFF the reclaim beat (a forward path exists).
  const atReclaim: ConvState = {
    stage: 'reclaim',
    collected: { athleticPast: 'a competitive cyclist who rode every weekend', identityNoun: 'Athlete' },
  };
  const { turns, finalState } = replay(
    [
      // She names what she wants back — model reflects warmly but records NOTHING.
      { member: 'I want to ride again, sleep through the night, and feel like myself on the trail', model: { text: 'Those are real — I can picture all three of them.' } },
      // The dead-end symptom: she wonders if it's stuck (degraded/empty model turn).
      { member: 'I just told you — is this thing stuck?', model: { text: '' } },
      // She restates; this time the model records the list — the beat must now advance.
      { member: 'ride again, sleep well, feel like myself on the trail', model: { text: 'Got them down.', record: { reclaimList: ['ride again', 'sleep well', 'feel like myself on the trail'] } } },
    ],
    atReclaim,
  );
  assertInvariants(turns); // never repeats verbatim, never strands a non-final turn, never completes unmet
  assert.ok((finalState.collected.reclaimList ?? []).length >= 3, 'reclaim list captured once recorded');
  assert.notEqual(finalState.stage, 'reclaim', 'advances off the win-list step once the items are in — a forward path exists');
});

test('REPLAY — identity gate: model drifts past naming; engine holds, then the member skips', () => {
  const fromIdentityNamed: ConvState = { stage: 'identity_name', collected: { athleticPast: 'someone who used to chase the next big thing' } };
  const { turns, finalState } = replay(
    [
      // Model drifts to the Reclaim List without recording an identity — engine must hold at naming.
      { member: 'I had a lot going on back then', model: { text: 'So what do you want back these days?' } },
      // Member declines to name it — engine sets identitySkipped and moves on.
      { member: 'honestly I’m not sure yet', model: { text: 'That’s completely fine.' } },
    ],
    fromIdentityNamed,
  );
  assertInvariants(turns);
  assert.equal(turns[0]!.state.stage, 'identity_name', 'held at the naming beat while identity is unset');
  assert.equal(finalState.collected.identitySkipped, true, 'an explicit "not sure" advances via skip');
  assert.notEqual(finalState.stage, 'identity_name', 'no longer trapped at naming once skipped');
});
