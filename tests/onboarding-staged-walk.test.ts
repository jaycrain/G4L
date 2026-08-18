import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStagedTurn, isProcessMetaOrAssent } from '../lib/agent/onboarding-staged.ts';
import { detectCrisis } from '../lib/agent/governance.ts';
import { BEAT_SEP } from '../lib/agent/onboarding.ts';
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

// ---------------------------------------------------------------------------
// DONNA'S WALK (2026-08-18) — THE SAME BUG AS JAY'S, ONE SENTENCE OVER.
//
// Jay's fix above made the corroboration gate rescue a close the MODEL mislabelled. Donna's close was mislabelled
// one layer lower — by the DETERMINISTIC read itself — so the gate never engaged: it only converts 'more' → 'done'
// when the deterministic read is already 'done'. "It was primarily around those three things" closes by pointing
// BACK, and every branch of GAP_DONE_RE is anchored on "that's ___", so it scored as a fresh chapter on length
// alone. Same visible symptom Jay reported: no builder, and the model ran the reclaim conversation itself.
//
// Kept as its own fixture rather than another string in Jay's loop, because the two failed for DIFFERENT reasons
// and a shared loop would hide that — Jay's exercises the gate, Donna's exercises the read underneath it.
// ---------------------------------------------------------------------------
test('GAP CONFIRM — a close that points BACK ("primarily around those three things") reaches the builder', () => {
  const atGapConfirm = (): ConvState => ({
    stage: 'gap',
    awaitingConfirm: true,
    collected: {
      athleticPast: 'making things, on set',
      identityNoun: 'Maker',
      gap: 'I lost my job two years ago. Then the partnership fell through. Six months after the work ended my dad got really ill — a coma, almost gone.',
      doors: ['career', 'caregiving'],
    },
  });
  const hist: ConvMessage[] = [
    { role: 'agent', text: "Was your dad's illness the last of what landed in that stretch, or was there still more?" },
  ];
  for (const replyIntent of [undefined, 'done' as const, 'more' as const]) {
    const t = applyStagedTurn(atGapConfirm(), hist, 'It was primarily around those three things.', {
      text: 'Three things, close together.',
      ...(replyIntent ? { replyIntent } : {}),
    });
    assert.equal(t.state.stage, 'reclaim', `replyIntent=${replyIntent}: must advance out of gap`);
    assert.equal(t.expects?.kind, 'reclaim_list', `replyIntent=${replyIntent}: the structured builder must fire`);
    // The AUTHORED bridge must carry the handoff. Its whole job is that the heavy gap beat does not cold-pivot —
    // Donna got "Now — what do you want back?", which is the model improvising because the engine never advanced.
    assert.match(t.reply, /none of it is gone/, `replyIntent=${replyIntent}: the authored reclaim bridge must speak`);
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
// THE RECLAIM LIST IS THE MEMBER'S OWN WORDS — the engine never interrogates it.
//
// Jennifer's live walk (2026-07-30) looped: the shape gate asked its question, she answered, it re-asked VERBATIM.
// Proximate cause was dead code (gateNextShape parked a proposal on `pendingReclaimShape`; resolvePendingShape knew
// how to apply her answer; nothing connected them). But the real cause was older: the shape gate is EXTRACTION-ERA
// machinery. It existed to reconcile lists the engine had GUESSED out of prose. Since the structured builder shipped
// (2026-07-29) the member types her own entries verbatim — so the gate was interrogating words she wrote herself.
//
// The fix is structural: a builder submission is never gated, and resolving a proposal never re-gates. At most ONE
// proposal can ever be posed, and none at all on the live path — so there is no cycle in the graph to get stuck in.
// Shaping moved to where it belongs: she edits the list from the rail, with the Companion's help, un-blocked.
// ---------------------------------------------------------------------------
const JENNIFER_PARAGRAPH =
  'I want to get back in shape—toned, stronger for bone health and balance, and feeling confident in my own skin ' +
  'again.  I also want to get back to healthy eating—working toward NOT being an emotional eater.  I also want to ' +
  'get back to walking every day..';

test('RECLAIM — a multi-want paragraph the MEMBER typed is kept verbatim and never interrogated', () => {
  // Jennifer's exact entry. The old gate quoted her own sentence back at her ("You named a few things in ...")
  // and asked her to pick one. She typed it; it is hers; it goes through untouched.
  const t = applyStagedTurn(
    atReclaim(),
    [],
    `• ${JENNIFER_PARAGRAPH}\n• Get back to reading\n• See my sister more`,
    { text: '' },
  );
  assert.doesNotMatch(t.reply, /Which one do you most want back/, 'her own words are never interrogated');
  assert.equal(t.state.stage, 'grinta', 'straight through to the baseline survey');
  assert.deepEqual(t.state.collected.reclaimList, [JENNIFER_PARAGRAPH, 'Get back to reading', 'See my sister more']);
});

test('RECLAIM — near-duplicate entries the MEMBER typed are kept, not merge-prompted', () => {
  // The second loop she hit. Two similar entries are her call to make, from the rail, later — not a gate.
  const t = applyStagedTurn(
    atReclaim(),
    [],
    '• Get back in shape and walk daily\n• Get back in shape and walking daily\n• See my sister more',
    { text: '' },
  );
  assert.doesNotMatch(t.reply, /sound like the same thing to me/, 'no merge question on member-authored entries');
  assert.equal((t.state.collected.reclaimList ?? []).length, 3, 'nothing folded, nothing dropped');
  assert.equal(t.state.stage, 'grinta');
});

test('RECLAIM — NO builder submission can ever produce a proposal (the loop is structurally impossible)', () => {
  // The property that matters, not one example of it: across every shape the old gate could detect — multi-want,
  // near-duplicate, whole-life vision, identity statement — a builder submission goes straight through with no
  // pending proposal parked on state. No proposal ⇒ no answer to mis-handle ⇒ no cycle to get stuck in.
  const lists = [
    `• ${JENNIFER_PARAGRAPH}\n• Get back to reading\n• See my sister more`,
    '• Get back in shape and walk daily\n• Get back in shape and walking daily\n• See my sister more',
    '• I want a life that feels like mine again\n• Run a 5k\n• Call my brother',
    "• I'm a runner\n• Sleep through the night\n• Cook properly again",
    '• Golf again\n• Lose 20 lbs\n• Call my brother',
  ];
  for (const list of lists) {
    const t = applyStagedTurn(atReclaim(), [], list, { text: '' });
    assert.equal(t.state.pendingReclaimShape, undefined, `a proposal was parked for: ${list}`);
    assert.equal(t.state.stage, 'grinta', `did not advance for: ${list}`);
    assert.equal((t.state.collected.reclaimList ?? []).length, 3, `entries were altered for: ${list}`);
  }
});

test('RECLAIM — a session ALREADY holding a proposal is resolved and released, never re-asked', () => {
  // Jennifer was mid-walk with a proposal parked on her state when the fix shipped. Her answer must apply and let
  // her through in ONE turn — resolving never re-gates, so there is no second question and no way back into a loop.
  const stuck: ConvState = {
    stage: 'reclaim',
    awaitingConfirm: true,
    collected: {
      athleticPast: 'a walker',
      identityNoun: 'Walker',
      gap: 'It faded.',
      reclaimList: ['Get back in shape and walk daily', 'Get back in shape and walking daily', 'See my sister more'],
    },
    pendingReclaimShape: { kind: 'overlap', keep: 'Get back in shape and walk daily', drop: 'Get back in shape and walking daily' },
  };
  const t = applyStagedTurn(stuck, [{ role: 'agent', text: 'sound like the same thing to me — want me to keep them as one?' }], 'We can keep them as one.', { text: '' });
  assert.doesNotMatch(t.reply, /sound like the same thing to me|Which one do you most want back/, 'never re-asked');
  assert.equal(t.state.pendingReclaimShape, undefined, 'the proposal is cleared, not re-parked');
  assert.equal((t.state.collected.reclaimList ?? []).length, 2, 'her answer was honoured — the two became one');
  assert.equal(t.state.stage, 'grinta', 'and she is released in a single turn');
});

test('SHAPE-GATE — an answer to our own proposal is never committed as a life-want (Jennifer, W-42 class)', () => {
  // The structural fix keeps these off the append path entirely; this pins the chokepoint guard beneath it, so the
  // rule survives any future path. Same shape as Scott's exit line and Donna's protest landing as Reclaim items.
  for (const reply of [
    'We can keep them as one.',
    'Keep them as one',
    'keep both',
    "They're different.",
    'No, they are separate',
    'Yes, merge them',
  ]) {
    assert.equal(isProcessMetaOrAssent(reply), true, `must not be a want: ${reply}`);
  }
  // And it must NOT swallow real wants that happen to use those verbs.
  for (const want of [
    'Keep my strength up as I age',
    'Keep walking every day',
    'Merge my work and my running so I stop choosing',
    'Keep both of my knees healthy enough to hike',
  ]) {
    assert.equal(isProcessMetaOrAssent(want), false, `must stay a want: ${want}`);
  }
});

// ---------------------------------------------------------------------------
// CAT-18 / CAT-20 — structured input into a free-text gate, and fallbacks that repeat verbatim.
// ---------------------------------------------------------------------------

test('CAT-18 — a bulleted list pasted at the gap confirm is KEPT as wants, not folded into the gap prose', () => {
  // It used to be classified as an "addition" and joined raw into the narrative — "…what to do with myself.
  // • Rediscover what I enjoy" — corrupting the stored gap, and those items never reached the Reclaim List.
  const state: ConvState = {
    stage: 'gap',
    awaitingConfirm: true,
    collected: { athleticPast: 'a runner', identityNoun: 'Runner', gap: 'The job swallowed me and I stopped running.' },
  };
  const t = applyStagedTurn(state, [], '• Rediscover what I enjoy\n• Get back to walking\n• See my friends again', {
    text: 'Thank you for that.',
  });
  const gap = t.state.collected.gap ?? '';
  assert.doesNotMatch(gap, /Rediscover what I enjoy/, 'the list must not pollute the gap narrative');
  assert.doesNotMatch(gap, /•/, 'no bullets in prose meant to be their story');
  const list = t.state.collected.reclaimList ?? [];
  assert.equal(list.length >= 3, true, 'never drop what they gave you — the items are kept as wants');
  assert.match(t.reply, /kept those/i, 'and they are told so');
});

test('CAT-18 — an ordinary sentence is NOT mistaken for a list (the guard must not swallow real story)', () => {
  const state: ConvState = {
    stage: 'gap',
    awaitingConfirm: true,
    collected: { athleticPast: 'a runner', identityNoun: 'Runner', gap: 'The job swallowed me.' },
  };
  const msg = 'Then in 2019 my mother got sick - I was driving up every weekend for two years, and it just stopped.';
  const t = applyStagedTurn(state, [], msg, { text: 'That is a lot to carry.' });
  assert.match(t.state.collected.gap ?? '', /mother got sick/, 'a real chapter still lands in the gap');
});

test('CAT-20 — the ENGINE BODY never repeats verbatim, even though the model receipt varies', () => {
  // The no-verbatim guard compared the WHOLE reply, but withQuestion prepends the model's varying receipt — so the
  // engine body could repeat byte-for-byte while the whole reply differed, and the guard never fired. To a terse
  // member that reads as a broken loop: the same paragraph again, as though nothing they said had registered.
  // So the assertion strips the receipt and compares the BODY — precisely what the old guard failed to do.
  const RECEIPT = 'Take your time.';
  const bodyOf = (reply) => reply.split(BEAT_SEP).join(' ').split(RECEIPT).join(' ').replace(/\s+/g, ' ').trim();

  const seen = new Set();
  let state = { stage: 'identity', collected: {} };
  const hist = [];
  let exercised = 0;
  for (let i = 0; i < 3; i++) {
    const t = applyStagedTurn(state, hist, 'i dont know', { text: RECEIPT });
    const body = bodyOf(t.reply);
    assert.equal(seen.has(body), false, `the engine body repeated verbatim on turn ${i + 1}: "${body.slice(0, 70)}"`);
    seen.add(body);
    exercised++;
    hist.push({ role: 'member', text: 'i dont know' }, { role: 'agent', text: t.reply });
    state = t.state;
    if (t.state.stage !== 'identity') break;
  }
  assert.ok(exercised >= 2, 'the fixture must actually run consecutive identity turns, or it proves nothing');
});

test('LIVE-WALK — every want the model records on a GAP turn is kept, never just the last one', () => {
  // Joanne's walk (2026-07-30, persona-walk): the Companion read three wants back to her in the gap stage, she
  // said "yes, that's it" — and only ONE was stored. The prompt now forbids composing a list there at all, but
  // this pins the engine half: if wants DO come through on a gap turn, all of them survive. Telling a member we
  // have her list and keeping a third of it is the worst version of "never drop what they gave you".
  const state: ConvState = {
    stage: 'gap',
    awaitingConfirm: false,
    collected: { athleticPast: 'a swimmer', identityNoun: 'Elemental' },
  };
  const t = applyStagedTurn(state, [], 'I stopped swimming when mum got sick, and I never went back.', {
    text: 'That was the hinge.',
    record: {
      gap: 'I stopped swimming when mum got sick, and I never went back.',
      reclaimList: ['Get back in open water', 'Make the piece I have been carrying', 'Know what I am made of again'],
    },
  });
  const list = t.state.collected.reclaimList ?? [];
  assert.equal(list.length, 3, `all three wants must survive the turn — got ${list.length}: ${JSON.stringify(list)}`);
  assert.ok(list.includes('Get back in open water'));
  assert.ok(list.includes('Make the piece I have been carrying'));
});

// ---------------------------------------------------------------------------
// STAGE AGREEMENT — the engine's stage and the model's turn must describe the same conversation.
//
// Donna's walk (2026-08-18, "The Rush"). The model asked "what do you want back?" while the engine still believed
// it was drawing out the gap, so she built her entire Reclaim List in chat — and was then handed the builder for a
// list she had already made: "Didn't we just do my Reclaim List?"
//
// This is the SEAM test. lib/agent/stage-agreement.ts is unit-tested on its own, but a resolver that is never
// reached is the exact shape that produced an infinite loop from dead code once already — so this drives the real
// engine and asserts the member's experience, not the module's return value.
// ---------------------------------------------------------------------------

const DONNA_GAP =
  'I lost my job two years ago — the thing I had been building toward, the team, the final say on set, all of it ' +
  'gone. Then a partnership I was counting on fell through, and six months after the work ended my dad got really ' +
  'ill, a coma, almost dying. I have not felt like myself since.';

const atGapWithStory = (): ConvState => ({
  stage: 'gap',
  collected: {
    athleticPast: 'Making things, on set, in the room where it happened',
    identityNoun: 'Maker',
    gap: DONNA_GAP,
  },
});

test('STAGE AGREEMENT — wants named to a run-ahead model are PARKED, and read back when the gap closes', () => {
  const { turns, finalState } = replayStaged(
    [
      // The model closes the gap in its own words and pivots. The engine did not author this transition.
      { member: 'It was primarily around those three things.', model: { text: 'Three things, close together. Now — what do you want back?' } },
      // She is now answering the MODEL's question while the engine still believes it is in `gap`. Both of these
      // were lost entirely before: the engine was not listening for wants, and the model recorded none.
      { member: 'Firstly, I want financial stability.', model: { text: 'Financial stability — first and clearest. What else do you want back?' } },
      { member: 'I want a real drop in conflict in my day-to-day.', model: { text: 'Less conflict day to day.' } },
      // The gap runs its own reflect-confirm and closes. THIS is where the recovery has to show up.
      { member: "No, that's it — that's the whole of it.", model: { text: 'Understood.', replyIntent: 'done' } },
      { member: "Yes, you've got it.", model: { text: 'Thank you for trusting me with it.', replyIntent: 'done' } },
    ],
    atGapWithStory(),
  );

  const list = finalState.collected.reclaimList ?? [];
  assert.ok(
    list.some((x) => /financial stability/i.test(x)) && list.some((x) => /conflict/i.test(x)),
    `both wants must survive the divergence, got ${JSON.stringify(list)}`,
  );

  // The opener must READ THEM BACK rather than open blank. Blank is the exact moment Donna asked
  // "Didn't we just do my Reclaim List?" — the same screen, seeded, is the answer to that question.
  const opener = turns[turns.length - 1]!.reply;
  assert.match(opener, /earlier you said you want/i);
  assert.doesNotMatch(opener, /let'?s write down what you want back/i);
});

test('STAGE AGREEMENT — the Reclaim opener is never replayed at a member who already built the list', () => {
  const { turns } = replayStaged(
    [
      { member: 'It was primarily around those three things.', model: { text: 'Now — what do you want back?' } },
      { member: 'Firstly, I want financial stability.', model: { text: 'Financial stability — first and clearest. What else?' } },
      { member: 'I want a real drop in conflict in my day-to-day.', model: { text: 'Less conflict day to day. What else do you want back?' } },
      { member: "No. Let's keep moving.", model: { text: 'Understood.' } },
    ],
    atGapWithStory(),
  );
  // "Let's write down what you want back" is the authored opener. Firing it AFTER she has listed her wants is the
  // exact moment Donna asked "Didn't we just do my Reclaim List?".
  const replayed = turns.filter((t) => /let'?s write down what you want back/i.test(t.reply));
  assert.equal(replayed.length, 0, 'the builder opener must not be shown to a member who already listed their wants');
});

test('STAGE AGREEMENT — a model jumping ahead BEFORE a gap story exists cannot skip the gap', () => {
  const { finalState } = replayStaged(
    [
      // The model opens Reclaim early. Nothing acts on it this turn — she has not answered it yet.
      { member: 'It just crept up on me.', model: { text: 'Now — what do you want back?' } },
      // NOW she is answering it, and the divergence is real. But no gap story exists, so the engine must HOLD.
      { member: 'I want to get back in shape.', model: { text: 'What else do you want back?' } },
    ],
    { stage: 'gap', collected: { athleticPast: 'Active', identityNoun: 'Maker' } },
  );
  assert.equal(finalState.stage, 'gap', 'the gap must not be skipped just because the model ran ahead');
  // ...but what she said is still not lost.
  assert.ok((finalState.collected.reclaimList ?? []).length >= 1, 'her want must be captured even while the engine holds');
});

// THE BRIDGE EXISTS ON BOTH PATHS, OR IT DOES NOT EXIST.
//
// The gap→reclaim bridge was written for the blank opener ("we don't cold-pivot to 'Now, the good part'") and never
// reached the parked-wants branch, so every front-loader got the cold version for weeks — invisibly, because the
// branch nobody walks is the branch nobody reads. One fact, two call sites, one of them wrong. This asserts the
// warmth on BOTH, so the next person to touch one cannot silently leave the other behind.
test('the gap→reclaim bridge is on BOTH openers, and the cold pivot is gone from both', () => {
  const blank = replayStaged(
    [
      { member: "No, that's it — that's the whole of it.", model: { text: 'Understood.', replyIntent: 'done' } },
      { member: "Yes, you've got it.", model: { text: 'Thank you.', replyIntent: 'done' } },
    ],
    atGapWithStory(),
  ).last.reply;

  const parked = replayStaged(
    [
      // The model pivots to Reclaim on its own — this is what puts the tell in the PRIOR agent turn.
      { member: 'It just kept going after that.', model: { text: 'Now — what do you want back?' } },
      // ...so this answer is heard as a want and parked, even though the engine is still in `gap`.
      { member: 'Firstly, I want financial stability.', model: { text: 'Financial stability — first and clearest.' } },
      { member: "No, that's it — that's the whole of it.", model: { text: 'Understood.', replyIntent: 'done' } },
      { member: "Yes, you've got it.", model: { text: 'Thank you.', replyIntent: 'done' } },
    ],
    atGapWithStory(),
  ).last.reply;

  for (const [label, reply] of [['blank', blank], ['parked', parked]] as const) {
    assert.match(reply, /that's a lot to have been carrying/i, `${label} opener lost the bridge`);
    assert.match(reply, /none of it is gone/i, `${label} opener lost the turn toward hope`);
    assert.doesNotMatch(reply, /now, the good part/i, `${label} opener cold-pivots`);
  }
  // The parked branch must still prove nothing was dropped, and point at the builder rather than ending on a
  // bare "What else?" with nowhere visible to answer.
  assert.match(parked, /earlier you said you want/i);
  assert.match(parked, /add anything else below/i);
});

// DIVERGENCE IS STICKY, OR IT ONLY CATCHES THE FIRST WANT.
//
// Found by Donna's persona on the live model against v3.4.12: 1 of 3 wants captured. The tell ("what do you want
// back?") appears ONCE, and the model's follow-ups are bare "What else?" — which is not a tell, and must not
// become one (it is far too generic to prove which stage anyone is in). So detection has to persist: once the
// model has demonstrably taken the member into Reclaim, they are still there next turn.
test('STAGE AGREEMENT — every want survives, not just the one right after the tell', () => {
  const { finalState } = replayStaged(
    [
      { member: 'It was primarily around those three things.', model: { text: 'Three things, close together. Now — what do you want back?' } },
      { member: 'A creative role that covers the bills each month.', model: { text: 'That is concrete. What else?' } },
      { member: "I've put on 20 lbs and lost strength and fitness.", model: { text: 'Getting that back. What else?' } },
      { member: 'I want a real drop in conflict day to day.', model: { text: 'Less conflict.' } },
    ],
    atGapWithStory(),
  );
  const list = finalState.collected.reclaimList ?? [];
  assert.equal(list.length, 3, `all three wants must be kept, got ${JSON.stringify(list)}`);
});
