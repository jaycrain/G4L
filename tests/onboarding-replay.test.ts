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

// A member who's reached the Door beat (identity named, Reclaim List in, the Door question already posed)
// — the shape Donna was in. doorAsked:true = the beat has been entered, so the gap can now be captured.
const atDoorBeat: ConvState = {
  stage: 'door',
  doorAsked: true,
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

test('REPLAY — full happy path from scratch (identity → reclaim → Door beat → complete)', () => {
  const { turns, finalState } = replay([
    { member: 'I was a competitive cyclist who rode every weekend', model: { text: 'That comes through clearly.', record: { athleticPast: 'a competitive cyclist who rode every weekend' } } },
    { member: 'The Athlete', model: { text: 'The Athlete it is.', record: { identityNoun: 'Athlete' } } },
    { member: 'ride again, sleep well, coach a friend', model: { text: 'A real list.', record: { reclaimList: ['ride again', 'sleep well', 'coach a friend'] } } },
    // The list is in and she confirms it — the engine ENTERS the Door beat and asks how the gap opened
    // (it does NOT capture a gap or complete off the list itself).
    { member: 'that’s my list', model: { text: 'Good — that’s a real list.' } },
    { member: 'my role was cut and the riding quietly stopped', model: { text: 'That’s the Career Cliff.', record: { gap: 'my role was cut and the riding quietly stopped', doors: ['career_cliff'] } } },
    { member: 'that’s everything', model: { text: 'Okay — the Career Cliff is how it started, and the Athlete is who we’re bringing back. Ready when you are.', record: { complete: true } } },
  ]);
  assertInvariants(turns);
  assert.equal(turns[turns.length - 1]!.complete, true);
  assert.equal(finalState.collected.identityNoun, 'Athlete');
  assert.deepEqual(finalState.collected.doors, ['career_cliff']);
  assert.equal((finalState.collected.reclaimList ?? []).length, 3);
  // The Door question was actually posed once the list was done — before any gap was captured.
  assert.match(turns[3]!.reply, /gap began to open|first felt the drift|how it went for you/i, 'Door question posed once the list is done');
  // The beat breathed: a thin single-Door gap did NOT complete on the turn it was given.
  assert.equal(turns[4]!.complete, false, 'thin gap explores before closing');
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

test('REPLAY — Donna: confirming the Reclaim List must not complete or fabricate a gap before the Door beat', () => {
  // The reported failure (Donna, fresh run): identity skipped, the Reclaim List fills, and on the turn she
  // confirms the LIST is done the model paraphrases a Reclaim item into `gap` — so the intake completed
  // and handed off to the IDQ with a fabricated fade story, the DOOR QUESTION NEVER ASKED. The engine must
  // not equate "list reached the minimum" with "in the Door beat": a list confirmation must pose the Door
  // question, never accept a paraphrased Reclaim item as the fade story, and never complete here.
  const steps = [
    { member: 'I felt most like myself as a filmmaker — completely at home in my own life and my community.',
      model: { text: 'Being at home in your own life — that comes through.', record: { athleticPast: 'a filmmaker, at home in her own life and community' } } },
    { member: 'Honestly I’m not sure I can put it in one word yet.',
      model: { text: 'That’s completely fine — you’ll find it through the work. Let’s talk about what you want back.', record: { identitySkipped: true } } },
    { member: 'Feeling at home in my own home; walking Maple, my chocolate lab, as a daily rhythm; work I enjoy that pays well enough that money isn’t a constant worry.',
      model: { text: 'That’s a real start.', record: { reclaimList: ['Feel at home in my own home', 'Walk Maple as a daily rhythm', 'Enjoyable work that pays well enough that financial concerns aren’t a constant worry'], reclaimCategories: ['self', 'physical', 'life'] } } },
    { member: 'Also losing 20 lbs, and a bigger volunteer role with the Boulder County Film Commission and Sundance.',
      model: { text: 'Got it — anything else, or does that feel like the list?', record: { reclaimList: ['Feel at home in my own home', 'Walk Maple as a daily rhythm', 'Enjoyable work that pays well enough that financial concerns aren’t a constant worry', 'Lose 20 lbs', 'A bigger volunteer role with the Boulder County Film Commission and Sundance'], reclaimCategories: ['self', 'physical', 'life', 'physical', 'social'] } } },
    // DECISIVE: she confirms the LIST is done; the model paraphrases Reclaim item #3 into `gap`.
    { member: 'That’s everything.',
      model: { text: 'Anything else, or does that feel like the list?', record: { gap: 'Clients and projects that are work I enjoy that pays well enough that I don’t have financial concerns' } } },
  ];
  const { turns, finalState } = replay(steps);
  const last = turns[turns.length - 1]!;
  assert.equal(last.complete, false, 'must NOT complete on a Reclaim-List confirmation — the Door beat never ran');
  assert.ok(!finalState.collected.gap, 'must NOT accept a paraphrased Reclaim item as the fade story');
  assert.match(last.reply, /gap began to open|first felt the drift|how it went for you/i, 'must pose the Door question next');
  assertInvariants(turns);
});

// A member already in the Door beat (the boundary set), used by the reconciliation fixtures below.
const inDoorBeatRee: ConvState = {
  stage: 'door',
  doorAsked: true,
  doorBeatFromIndex: 0,
  collected: {
    athleticPast: 'a leader who carried people and made things',
    identitySkipped: true,
    reclaimList: ['paid design and writing work', 'finish the podcast', 'lose 20 lbs'],
  },
};

test('REPLAY — Leg 3 reconciliation: a Door the member raised but the model dropped is caught and confirmed in their words', () => {
  // Ree/Donna's real run: she raised caring for her aging mother DURING onboarding, but the model's gap
  // SUMMARY dropped it (no aging_parents Door). Before completing, the engine must catch the Door signal
  // in her OWN words and ask one confirm — and on her yes, record it.
  const { turns, finalState } = replay(
    [
      // The fade story — job loss AND caring for her mother. The model records the gap + one Door but
      // DROPS the mother (no aging_parents), exactly as it did live.
      { member: 'I lost my job at 57 after they dangled a promotion. And these past two years I’ve been taking care of my mother as her health failed — I’m the one driving up every week.',
        model: { text: 'That’s a lot landing at once.', record: { gap: 'Lost her job at 57 right after a promotion was dangled.', doors: ['career_cliff'] } } },
      // She signals the story is complete — the engine is about to hand off.
      { member: 'That’s the whole of it.', model: { text: 'Okay — that’s the picture.', record: { complete: true } } },
      // Reconciliation must have intercepted with a confirm in HER words; she confirms → record it.
      { member: 'Yes, I’m her main caregiver.', model: { text: 'Thank you for telling me.' } },
    ],
    inDoorBeatRee,
  );
  assert.equal(turns[1]!.complete, false, 'did not hand off while a Door she raised was unrecorded');
  assert.match(turns[1]!.reply, /its own Door|the background/i, 'asked whether the dropped thread is a Door');
  assert.match(turns[1]!.reply, /mother/i, 'reflected her OWN words (caring for her mother) back');
  assert.ok((finalState.collected.doors ?? []).includes('aging_parents'), 'the confirmed Door is recorded');
  assert.equal(turns[turns.length - 1]!.complete, true, 'completes once the dropped Door is confirmed');
  assertInvariants(turns);
});

test('REPLAY — Leg 3 / Part B: a Door recognized earlier in the beat survives a later fumbled record (accumulate, not replace)', () => {
  // Ree's run: the model recognized THREE Doors out loud (Career Cliff, Load-Bearer, Aging Parents), then
  // its final record carried a different two — and a replace-merge dropped the recognized ones, so the card
  // showed fewer Doors than the conversation established. Doors must ACCUMULATE: a later record may add a
  // (wrong) Door, but can never silently drop one already recognized.
  const atDoor: ConvState = {
    stage: 'door', doorAsked: true, doorBeatFromIndex: 0,
    collected: { athleticPast: 'a leader', identitySkipped: true, reclaimList: ['design work', 'the podcast', 'lose 20 lbs'] },
  };
  const { finalState } = replay(
    [
      // Turn 1: the model recognizes and records all three real Doors.
      { member: 'I was laid off at 57. I’d carried us financially for years while my husband was out of work, and around then I was also caring for my aging mother.',
        model: { text: 'Three Doors stacked here.', record: { gap: 'Laid off at 57 after carrying the household financially for years while her husband was out of work, around the same time her mother’s health declined.', doors: ['career_cliff', 'load_bearer', 'aging_parents'] } } },
      // Turn 2: the final record FUMBLES — drops two recognized Doors, adds a wrong one.
      { member: 'That’s the whole of it.', model: { text: 'Okay.', record: { doors: ['career_cliff', 'loss'], complete: true } } },
    ],
    atDoor,
  );
  const doors = finalState.collected.doors ?? [];
  assert.ok(doors.includes('career_cliff'), 'kept');
  assert.ok(doors.includes('load_bearer'), 'a recognized Door is NOT dropped by a later record');
  assert.ok(doors.includes('aging_parents'), 'a recognized Door is NOT dropped by a later record');
});

test('REPLAY — Leg 3 reconciliation: a declined Door is set aside (never recorded) and the intake still completes', () => {
  const { turns, finalState } = replay(
    [
      { member: 'I lost my job at 57, and around then I was also taking care of my mother for a stretch.',
        model: { text: 'That’s real weight.', record: { gap: 'Lost her job at 57 after a promotion was dangled.', doors: ['career_cliff'] } } },
      { member: 'That’s the whole of it.', model: { text: 'Okay.', record: { complete: true } } },
      // She sets the surfaced Door aside — it must NOT be recorded, and we wrap without it (ask-never-assert).
      { member: 'No — that was temporary, just background. The job was the thing.', model: { text: 'Got it.' } },
    ],
    inDoorBeatRee,
  );
  assert.equal(turns[1]!.complete, false, 'held to ask the confirm');
  assert.match(turns[1]!.reply, /its own Door|the background/i);
  assert.ok(!(finalState.collected.doors ?? []).includes('aging_parents'), 'a declined Door is never recorded');
  assert.deepEqual(finalState.collected.doors, ['career_cliff'], 'only the real Door remains');
  assert.equal(turns[turns.length - 1]!.complete, true, 'still completes after the member sets it aside');
  assertInvariants(turns);
});
