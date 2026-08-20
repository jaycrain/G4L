import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  onboardingNextTurn,
  scriptedTurn,
  collectedToFields,
  nextStage,
  withForwardPrompt,
  resolveCompletion,
  isAffirmation,
  isDoorDispute,
  memberWantsToWrap,
  confirmsWhole,
  doorEngaged,
  augmentDoors,
  shouldCaptureGapFromMessage,
  ensureIdqHandoff,
  stripLeadingDisclosure,
  resolveIdentityGate,
  INITIAL_STATE,
  type ConvState,
  type Collected,
} from '../lib/agent/onboarding.ts';
import { matchDoors, hasResignationLanguage } from '../lib/doors.ts';
import { contractMet, contractGaps, buildSummaryCard } from '../lib/agent/onboarding-contract.ts';

const ctx = { name: 'Tom Miller', email: 'tom@example.com' };
const five = ['a', 'b', 'c', 'd', 'e'];

test('nextStage advances only as each requirement is met, and completes after the Door', () => {
  assert.equal(nextStage({}), 'identity');
  assert.equal(nextStage({ athleticPast: 'x' }), 'identity_name');
  assert.equal(nextStage({ athleticPast: 'x', identityNoun: 'Runner' }), 'reclaim');
  // fewer than the minimum (3) keeps us at reclaim
  assert.equal(nextStage({ athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b'] }), 'reclaim');
  assert.equal(nextStage({ athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b', 'c'] }), 'door');
  // A Door slug WITHOUT the fade story isn't a finished beat — stays in 'door' to draw out the gap.
  assert.equal(
    nextStage({ athleticPast: 'x', identityNoun: 'Runner', reclaimList: five, doors: ['career_cliff'] }),
    'door',
  );
  // Door + a real "how it opened" narrative → complete.
  assert.equal(
    nextStage({ athleticPast: 'x', identityNoun: 'Runner', reclaimList: five, doors: ['career_cliff'], gap: 'my role was cut and the riding quietly stopped' }),
    'complete',
  );
});

test('opening turn opens on the Getting-to-Know-You question (disclosure now lives on the start page)', async () => {
  const t = await onboardingNextTurn({ ctx, state: INITIAL_STATE, history: [], memberMessage: null });
  assert.doesNotMatch(t.reply, /guided by AI/); // the AI disclosure is woven into the start page, not repeated here
  assert.match(t.reply, /who you were/i); // identity-agnostic opening (voice rewrite v1)
  assert.match(t.reply, /writer|musician|builder|runner/i); // reclaimed identity is not limited to athletics
  assert.match(t.reply, /tell me about them/i); // a single, warm invitation to talk about that person
  assert.equal(t.complete, false);
  assert.equal(t.crisis, undefined);
});

test('a crisis disclosure mid-conversation halts and routes to 988, state unchanged', async () => {
  const state: ConvState = { stage: 'reclaim', collected: { athleticPast: 'cyclist', identityNoun: 'Cyclist' } };
  const t = await onboardingNextTurn({ ctx, state, history: [], memberMessage: "I don't want to be alive" });
  assert.equal(t.crisis, true);
  assert.match(t.reply, /988/);
  assert.equal(t.complete, false);
  assert.deepEqual(t.state, state); // nothing advanced or stored
});

test('full scripted conversation collects every field, in natural case, and completes', () => {
  let s = INITIAL_STATE;
  // Step 1: who they were (stored as athleticPast).
  const past = scriptedTurn(s, 'a competitive cyclist who rode every weekend');
  assert.equal(past.state.stage, 'identity_name');
  assert.equal(past.state.collected.athleticPast, 'a competitive cyclist who rode every weekend');
  s = past.state;

  // Step 1b: name it — natural case, not all-caps.
  const idTurn = scriptedTurn(s, 'athlete, I think');
  assert.equal(idTurn.state.collected.identityNoun, 'Athlete');
  assert.match(idTurn.reply, /The Athlete/); // natural case (capitalized at sentence start)
  assert.doesNotMatch(idTurn.reply, /ATHLETE/); // never all-caps
  s = idTurn.state;

  // too few re-prompts and does not advance
  const short = scriptedTurn(s, 'ride');
  assert.equal(short.state.stage, 'reclaim');
  assert.equal(short.state.collected.reclaimList, undefined);
  assert.match(short.reply, /three is enough to start/i);

  // three is enough now (no forced 7)
  const rc = scriptedTurn(s, 'ride again, sleep well, coach a friend');
  assert.equal(rc.state.stage, 'door');
  assert.equal(rc.state.collected.reclaimList?.length, 3);
  s = rc.state;

  const doorMsg = 'honestly the career cliff, and then my body started saying no';
  const doorTurn = scriptedTurn(s, doorMsg);
  assert.equal(doorTurn.complete, true);
  assert.deepEqual(doorTurn.state.collected.doors, ['career_cliff', 'body']); // multi-Door, canonical order
  assert.equal(doorTurn.state.collected.gap, doorMsg);

  // collected -> fields ready for persistence
  const fields = collectedToFields(ctx, doorTurn.state.collected);
  assert.equal(fields.displayName, 'Tom Miller');
  assert.deepEqual(fields.doors, ['career_cliff', 'body']);
  assert.equal(fields.reclaimList.length, 3);
  assert.equal(fields.identityNoun, 'Athlete');
});

test('completion is gated on BOTH sides: explore first, then close reliably', () => {
  const full = { athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b', 'c'], doors: ['career_cliff'], gap: 'my role was cut and the riding quietly stopped' } as Collected;
  const partial = { athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b', 'c'] } as Collected;

  // Under the exploration minimum → cannot complete; held in the door beat (even if the model asks).
  const just = resolveCompletion(full, true, 1);
  assert.equal(just.complete, false);
  assert.equal(just.stage, 'door');
  assert.equal(just.exploringDoor, true);
  assert.equal(resolveCompletion(full, true, 2).complete, false);

  // Explored enough + the model signals completion → done.
  const byModel = resolveCompletion(full, true, 3);
  assert.equal(byModel.complete, true);
  assert.equal(byModel.stage, 'complete');

  // Explored enough + the MEMBER affirms the read (model didn't set complete) → done. (The "It does" fix.)
  assert.equal(resolveCompletion(full, false, 4, true).complete, true);
  // Affirmation before the beat has breathed does NOT complete.
  assert.equal(resolveCompletion(full, false, 2, true).complete, false);

  // Soft cap: even with no model/member signal, it must wrap by DOOR_MAX_TURNS (can't run forever).
  assert.equal(resolveCompletion(full, false, 6).complete, true);
  // ...but never before requirements are met (missing a Door keeps it out of the door beat entirely).
  assert.equal(resolveCompletion(partial, true, 9).complete, false);
});

test('the member ending the beat wraps it — even below the explore-minimum (Independence Guarantee)', () => {
  const full = { athleticPast: 'x', identityNoun: 'Adventurer', reclaimList: ['a', 'b', 'c'], doors: ['body'], gap: 'my body started saying no and I slowly pulled back from the climbs' } as Collected;
  // "I'm done" on door turn 1 (below the 3-turn floor) still completes — the member's call to stop wins.
  assert.equal(resolveCompletion(full, false, 1, false, false, true).complete, true);
  // but a dispute still holds even if they sound done-ish (blocked overrides memberDone)
  assert.equal(resolveCompletion(full, false, 1, false, true, true).complete, false);
  // without the done signal, turn 1 still holds for exploration
  assert.equal(resolveCompletion(full, false, 1, false, false, false).complete, false);
});

test('confirmsWhole reads a soft close to the widen question (Scott: "the biggest contributors")', () => {
  for (const m of ['Those are the biggest contributors', "that's the main ones", 'those are the main factors', "that's the whole of it", 'that covers it', "that's the full picture"]) {
    assert.equal(confirmsWhole(m), true, `whole: "${m}"`);
  }
  // Not a closure — the member is still adding / pushing back.
  assert.equal(confirmsWhole('there was also my dad getting sick'), false);
  assert.equal(confirmsWhole('what do you mean?'), false);
  // It closes the beat (via memberDone) only once the contract is met — never a half-finished intake.
  const full = { athleticPast: 'x', identityNoun: 'Athlete', reclaimList: ['a', 'b', 'c'], doors: ['full_house'], gap: 'married young, kids to raise, a job that consumed me — nine years gone' } as Collected;
  assert.equal(resolveCompletion(full, false, 2, false, false, /*memberDone*/ true).complete, true, 'closes when contract met');
  const noGap = { athleticPast: 'x', identityNoun: 'Athlete', reclaimList: ['a', 'b', 'c'], doors: ['full_house'] } as Collected;
  assert.equal(resolveCompletion(noGap, false, 2, false, false, true).complete, false, 'never completes a half-finished intake');
});

test('memberWantsToWrap catches a clear "I\'m done" (incl. Joanne\'s line), not a normal answer', () => {
  for (const m of ['I am done I think as I want to go to bed', "that's it", 'nothing else', "let's move on", 'this is enough for now']) {
    assert.equal(memberWantsToWrap(m), true, `wrap: "${m}"`);
  }
  assert.equal(memberWantsToWrap('it was the body, and the career too'), false);
  assert.equal(memberWantsToWrap('there was more to it actually'), false);
});

test('a Door dispute reopens the beat — never wraps, even past the soft cap or when the model says complete', () => {
  const full = { athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b', 'c'], doors: ['career_cliff'] } as Collected;
  // Member is pushing back ⇒ blocked=true ⇒ cannot complete (model-signaled, affirmed, OR soft-cap).
  assert.equal(resolveCompletion(full, true, 3, false, true).complete, false);
  assert.equal(resolveCompletion(full, false, 6, false, true).complete, false);
  // It stays in the door beat to re-map, not stranded.
  assert.equal(resolveCompletion(full, true, 3, false, true).stage, 'door');
});

test('isDoorDispute catches real pushback (incl. Scott\'s line) but not an affirmation', () => {
  for (const d of ["What do you mean by Aging Parents and Empty Nest?", "those don't seem like the problem", "that's not it", "no, that wasn't what happened", "I wouldn't call it that"]) {
    assert.equal(isDoorDispute(d), true, `dispute: "${d}"`);
  }
  assert.equal(isDoorDispute('yes, that\'s right'), false);
  assert.equal(isDoorDispute('the body, and the career cliff too'), false);
});

test('door turns are counted only once the gap/Door is on the table (not when the Reclaim List just filled)', () => {
  // Reclaim just hit the minimum; no gap, no door yet → NOT a door turn (the beat hasn\'t begun).
  assert.equal(doorEngaged({ reclaimList: ['a', 'b', 'c'] } as Collected, { reclaimList: ['a', 'b', 'c'] } as Collected), false);
  // The member just told us how the gap opened → now we\'re engaging the Door beat.
  assert.equal(doorEngaged({} as Collected, { gap: 'when I got married then had kids' } as Collected), true);
  // A Door already captured earlier → still engaging on the next turn.
  assert.equal(doorEngaged({ doors: ['career_cliff'] } as Collected, {} as Collected), true);
});

test('augmentDoors infers Door(s) from the GAP narrative — incl. the first — but invents nothing from an empty gap', () => {
  // Donna's bug: a real gap named her doors, but none were recorded → she got re-asked the gap forever.
  // Inferring the first Door FROM THE GAP is reading her account, not fabricating.
  assert.deepEqual(augmentDoors([], 'caring for my 95 year old mom took over'), ['aging_parents']);
  // Run-3 protection: a skipped Door beat means an empty gap (never backfilled) → nothing invented.
  assert.deepEqual(augmentDoors([], ''), []);
  // Catches a second Door the model missed, alongside one it recorded.
  assert.deepEqual(
    augmentDoors(['career_cliff'], 'caring for my 95 year old mom took over'),
    ['career_cliff', 'aging_parents'],
  );
  // The caller passes the GAP only — so a fitness-heavy Reclaim List can't leak in: a career+caregiving
  // gap yields no spurious The Body.
  const joanneGap = 'Working too many hours, caring for my 95 year old mom with an inconsistent sister — the better part of 5 years';
  assert.deepEqual(augmentDoors(['career_cliff', 'aging_parents'], joanneGap), ['career_cliff', 'aging_parents']);
  // Jay's walk: the model tagged contradictory siblings — full_house AND empty_nest — for a kids-still-home
  // story (a daughter's struggles, marriage tension, the grind). Empty Nest is the mis-tag; the disambiguation
  // drops it (Full House present, no "kids left/moved out" signal) while keeping the real Doors.
  assert.deepEqual(
    augmentDoors(['marriage', 'full_house', 'grind', 'empty_nest'], 'Years of carrying my daughter’s struggles, a marriage under tension, and a company demanding everything.'),
    ['marriage', 'full_house', 'grind'],
  );
  // A genuine empty-nest story is untouched (kids actually left).
  assert.deepEqual(augmentDoors(['empty_nest'], 'the kids moved out and the house went quiet'), ['empty_nest']);
  // milie@ walk (2026-07-26): a rich gap named The Body (physical events, no word "body") and The Loss (a parent
  // died, not "lost my …") — the backstop caught NEITHER. Now the event language and "[relative] died" are read.
  assert.deepEqual(
    augmentDoors([], 'My father died. He had been a huge support. My knee hurts so I can’t run anymore and I throw my back out for days.'),
    ['body', 'loss'],
  );
});

test('isAffirmation recognizes short confirmations (incl. "for sure"), not longer add-ons', () => {
  for (const yes of ['For sure', 'yes', 'that’s right', 'exactly', 'you got it', 'pretty much', 'sounds about right', 'absolutely']) {
    assert.equal(isAffirmation(yes), true, `expected affirmation: "${yes}"`);
  }
  // long messages aren't treated as a wrap signal, even if they contain an affirming word
  assert.equal(isAffirmation('yes, and also my finances really started to pile on around then too'), false);
  assert.equal(isAffirmation('not really, there was more to it'), false);
  assert.equal(isAffirmation(''), false);
});

test('stripLeadingDisclosure removes a repeated AI disclosure but leaves the real reply', () => {
  // The exact turn-2 leak from Joanne's run: disclosure prepended to the actual reflection.
  const leaked =
    "This conversation is guided by AI. Everything you share shapes your G4L experience and is handled with the same care you'd expect from a person. You can stop at any time.\n\nThat's a vivid picture — the one who held the social fabric together. So — the Connector. Does that land?";
  const out = stripLeadingDisclosure(leaked);
  assert.doesNotMatch(out, /guided by AI/);
  assert.match(out, /^That's a vivid picture/);
  assert.match(out, /the Connector/);
  // A normal reply (no disclosure) is untouched.
  const clean = 'So — the Connector. Does that land, or is there a closer word?';
  assert.equal(stripLeadingDisclosure(clean), clean);
});

test('ensureIdqHandoff keeps the model\'s summary and only adds the IDQ transition when missing', () => {
  const summary = 'Here is your whole story reflected back — the house filling up, marriage and young kids, you carrying it all. That is The Full House.';
  const out = ensureIdqHandoff(summary);
  assert.match(out, /The Full House/); // the model's summary is preserved
  assert.match(out, /Ready when you are/); // the IDQ transition is appended
  // If the model already closed with the transition, it isn't doubled.
  const withTail = `${summary} Ready when you are.`;
  assert.equal(ensureIdqHandoff(withTail), withTail);
});

test('withForwardPrompt never leaves a non-final turn without a question', () => {
  // A bare reflection (no question) gets the forward question appended.
  const stalled = withForwardPrompt('That stays with you.', 'identity_name');
  assert.match(stalled, /That stays with you\./);
  assert.match(stalled, /\?$/m);
  assert.match(stalled, /what is the word/i);
  // A turn that already asks something is left alone (no double question).
  assert.equal(withForwardPrompt('And what shifted?', 'identity_name'), 'And what shifted?');
  // Empty model output falls back to the stage prompt.
  assert.match(withForwardPrompt('   ', 'reclaim'), /what are a few things you want back/i);
});

test('member names the Door(s) in free text; one or more map; unclear input re-prompts', () => {
  const doorState: ConvState = { stage: 'door', collected: {} };
  assert.deepEqual(scriptedTurn(doorState, 'the empty nest').state.collected.doors, ['empty_nest']);
  // The Loss is deliberately alias-only (death-specific) — the bare word "loss" over-tagged "job loss" /
  // "weight loss", so it maps from a real loss signal, not the ambiguous word.
  assert.deepEqual(scriptedTurn(doorState, 'my husband passed away').state.collected.doors, ['loss']);
  assert.deepEqual(scriptedTurn(doorState, 'aging parents and the marriage').state.collected.doors, [
    'aging_parents',
    'marriage',
  ]);

  const unclear = scriptedTurn(doorState, 'hard to say really');
  assert.equal(unclear.state.collected.doors, undefined);
  assert.equal(unclear.complete, false);
  assert.match(unclear.reply, /your own words/i);
});

test('identity opt-out: "I\'m not sure yet" skips naming, still completes', () => {
  // scripted decline at the naming step → identitySkipped, advances to reclaim, no identityNoun
  const afterPast = scriptedTurn({ stage: 'identity', collected: {} }, 'someone who rode every dawn');
  assert.equal(afterPast.state.stage, 'identity_name');
  const declined = scriptedTurn(afterPast.state, "honestly, I'm not sure yet");
  assert.equal(declined.state.collected.identitySkipped, true);
  assert.equal(declined.state.collected.identityNoun, undefined);
  assert.equal(declined.state.stage, 'reclaim');

  // nextStage doesn't loop on naming once skipped
  assert.equal(nextStage({ athleticPast: 'x', identitySkipped: true }), 'reclaim');

  // completion gate is satisfied by identitySkipped in place of identityNoun
  const five = ['a', 'b', 'c', 'd', 'e'];
  const gap = 'my role was cut and the riding quietly stopped';
  const skipped = { athleticPast: 'x', identitySkipped: true, reclaimList: five, doors: ['career_cliff'] as const, gap };
  assert.equal(resolveCompletion(skipped as never, true, 3).complete, true);
  // and a named member still completes the same way
  const named = { athleticPast: 'x', identityNoun: 'Runner', reclaimList: five, doors: ['career_cliff'] as const, gap };
  assert.equal(resolveCompletion(named as never, true, 3).complete, true);
});

// ============================================================================
// Doors Taxonomy Spec v1.0 — §7 acceptance tests (The Grind + The Load-Bearer,
// the §4 anti-collision precedence, null routing, the identity gate, regression).
// Acceptance bar: "Donna completes."
// ============================================================================

test('§7.1 recognition — Joanne routes to The Grind (work that GREW over her), not the Career Cliff', () => {
  // Career Cliff = the role ENDED. The Grind = the role GREW until it crowded out the self.
  const joanne = matchDoors('the job just kept getting bigger — more responsibility, crazy hours, it took over my life and there was no room left for me');
  assert.ok(joanne.includes('grind'), 'work-consumption maps to The Grind');
  assert.equal(joanne.includes('career_cliff'), false, 'work that GREW is not the Career Cliff (which is the role ending)');
});

test('§7.1 recognition — Donna routes to The Load-Bearer (household/financial load), not Full House / Aging Parents / Marriage', () => {
  // Donna's reproduction gap: a decade carrying the financial weight after a partner stepped back.
  const donna = matchDoors('when my husband semi-retired I held the financial weight for the family — I was carrying more than my fair share for a decade');
  assert.ok(donna.includes('load_bearer'), 'carrying everyone\'s load maps to The Load-Bearer');
  assert.equal(donna.includes('full_house'), false, 'not the active-family season');
  assert.equal(donna.includes('aging_parents'), false, 'not parent caretaking');
  assert.equal(donna.includes('marriage'), false, 'the Fade is the weight, not relational drift');
});

test('§7.2 collision — Load-Bearer yields to the specific load Door (Aging Parents / Full House) per §4 precedence', () => {
  // A story that trips BOTH a specific load Door and the Load-Bearer catch-all routes to the specific one.
  const withParentCare = matchDoors('I was carrying everyone — and caring for my aging mother on top of it all fell on me');
  assert.ok(withParentCare.includes('aging_parents'), 'parent care is recognized');
  assert.equal(withParentCare.includes('load_bearer'), false, 'Load-Bearer yields to the specific Aging Parents Door');

  const withFullHouse = matchDoors('married young, then we had kids, everyone leaning on me, and I was carrying the household with no room left');
  assert.ok(withFullHouse.includes('full_house'), 'active-family season is recognized');
  assert.equal(withFullHouse.includes('load_bearer'), false, 'Load-Bearer yields to the specific Full House Door');
});

// ── "provider" is the Load-Bearer's word, not the Full House's (Donna's live walk, 2026-08-20) ────────────────
//
// She onboarded on prod and her card asserted The Full House over a story with no partner and no children in it.
// The cause was ours, not the model's: DOOR_ALIASES.full_house contained the bare 'providing' and 'provider', and
// she had written "about providing high-quality work to my leaders" and "I was our family's sole financial
// provider" — one about her job, one about her money. The phantom then reached the §4 precedence rule and DELETED
// load_bearer, the Door her story actually evidences; it survived to the card only because the model had tagged it
// independently of the matcher. The rescue that should have caught that, STRONG_FINANCIAL_LOAD, read
// `sole (earner|provider)` and so did not match "sole financial provider" — one adjective was enough to lose it.
//
// Her VERBATIM gap is the fixture, because the paraphrase is what hid this: every summary of her story says "she
// was the family breadwinner", which the old matcher handled correctly. Only her actual sentences failed.
const DONNA_GAP = `Two years ago I lost my job. It wasn't one loss — it was several at once. I lost my creative outlet, but I also lost my agency: people came to me for answers, for decisions, for creative problem solving. I felt good about giving my freelance team work, about providing high-quality work to my leaders and internal clients, about mentoring and growing my team members. And I felt good about the money — I was our family's sole financial provider. When the job went, our financial situation became dire, and we still haven't climbed back out of it. Around the same time, my dad got really sick and almost died. Twice. He's still here, but with diminished health.`;

test('§7.3 — a job and a paycheque are not an active-family season (Donna, live walk)', () => {
  const doors = matchDoors(DONNA_GAP);
  assert.equal(doors.includes('full_house'), false, 'no partner and no children in this story — The Full House is not hers');
  assert.ok(doors.includes('career_cliff'), 'the job that ended');
  assert.ok(doors.includes('load_bearer'), 'sole financial provider is the load, and the §4 rescue must fire on it');
});

test('§7.3 — "sole financial provider" survives the qualifier the old rescue clause could not see', () => {
  // The precedence rule deletes load_bearer next to a specific load Door UNLESS a distinct financial load is
  // stated. Each of these states one; none may be read as no load at all.
  for (const phrase of ['sole financial provider', 'sole provider', 'only financial provider', 'sole earner']) {
    const doors = matchDoors(`I was caring for my aging mother, and I was the ${phrase} the whole time.`);
    assert.ok(doors.includes('aging_parents'), `parent care still recognized alongside "${phrase}"`);
    assert.ok(doors.includes('load_bearer'), `"${phrase}" is a load Aging Parents does not own`);
  }
});

// ── The Acceptance: ACKNOWLEDGING age is not ACCEPTING it (OPEN — recorded 2026-08-09, fix deferred) ──────────
//
// The Acceptance is "the quiet surrender to age — deciding that slower, softer and less capable is simply how it
// goes now, and expecting nothing else." It is a STANCE of having stopped expecting more. Noticing that you are
// older is not that. Most healthy midlife people say "I'm not as fast as I was" and are still training.
//
// The cue list currently mixes the two registers in one bucket. Surrender cues ("resigned myself", "made peace
// with", "settled for less", "my best years are behind me") sit alongside plain acknowledgment ("getting older",
// "at my age", "slowing down", "not as young as I used to be") — so acknowledgment alone tags the Door.
//
// The Body/Acceptance tiebreaker (EXPLICIT_SETTLED, lib/doors.ts) already knows the difference, but it only fires
// when a PHYSICAL cue is also present. With no Body cue, mere acknowledgment tags The Acceptance unopposed.
//
// Why this matters beyond tidiness: the Door is shown to the member at intake WITH its metaphor
// ([[doors-presented-at-intake]]), so a false positive hands someone a label about their own stance that they did
// not intend — and the two false cases below are members who are explicitly still working at it.
//
// §7.4 THE ACCEPTANCE — CLOSED (Decision C, Jay 2026-08-15).
//
// This pair sat open since 2026-08-09 as the only todo in the suite: the matcher could not tell NOTICING age from
// SURRENDERING to it, and the obvious fix (delete the soft cues) would have taken the true positives with them.
//
// The resolution was not a better matcher. It was recognising that the Door was one construct doing two jobs —
// admitting a resigned member (good) and labelling her as having surrendered (bad) — and that only the first
// needed to exist. The cues are unchanged; they no longer produce a Door. See docs/acceptance-door-retirement.md.
test('§7.4 a surrender stance still ADMITS — the intake signal is unchanged', () => {
  for (const stance of [
    'it is what it is, my best years are behind me',
    "I've made peace with being past my prime",
    'what do you expect at my age, I resigned myself to it',
  ]) {
    assert.equal(hasResignationLanguage(stance), true, `still a real Fade: "${stance}"`);
  }
});

test('§7.4 merely NOTICING age does not label anyone — and never blocks them either', () => {
  // The case that kept this open. She is explicitly still working at it; before C she was tagged as having
  // surrendered. Now she is admitted on the signal and labelled with nothing — which is the honest read of
  // someone who said "but I am working on it".
  const striving = 'I am not as young as I used to be, but I am working on it';
  assert.equal(matchDoors(striving).includes('acceptance' as never), false, 'not called a surrender');
  assert.equal(hasResignationLanguage(striving), true, 'and still admitted — her Fade is real');

  const noticing = 'I am slowing down a bit these days';
  assert.equal(matchDoors(noticing).includes('acceptance' as never), false, 'an observation about pace is not a verdict');
});

test('§7.3 no-map — a real Fade whose story maps to no Door completes (null routing), with own-words recognition', () => {
  const gap = 'It crept in over years — the version of me that took risks just quietly went silent, and I let it.';
  assert.deepEqual(matchDoors(gap), [], 'this story maps to no canonical Door');
  const nullRouted: Collected = {
    athleticPast: 'someone who used to chase the next big thing',
    identityNoun: 'Risk-Taker',
    reclaimList: ['Say yes to the trip', 'Start the side project', 'Speak up in the room'],
    gap,
    doors: [], // null routing
  };
  assert.deepEqual(contractGaps(nullRouted), [], 'no missing slots — a Door is not required');
  assert.equal(contractMet(nullRouted), true, 'the gap story carries recognition; the intake is complete');
  const card = buildSummaryCard(nullRouted);
  assert.equal(card.ready, true, 'the confirmation card is offerable with no Door');
  assert.deepEqual(card.doors, [], 'no Door, and no "Other" label invented');
  // The engine holds the beat to develop the story (never pushes to name a Door) until done.
  assert.equal(resolveCompletion(nullRouted as never, false, 1).stage, 'door', 'held in the beat below the explore-minimum');
  assert.equal(resolveCompletion(nullRouted as never, true, 3).complete, true, 'completes once explored, with no Door');
});

test('§7.4 regression — the existing load/work Doors keep their clean matches after the taxonomy change', () => {
  assert.deepEqual(matchDoors('I was laid off and the role just ended'), ['career_cliff']);
  assert.deepEqual(matchDoors('when I got married then had kids'), ['full_house']);
  assert.ok(matchDoors('caring for my aging mother took over').includes('aging_parents'));
  assert.deepEqual(matchDoors('we drifted into just coexisting, my marriage ended'), ['marriage']);
  assert.deepEqual(matchDoors('the kids moved out and the house got quiet'), ['empty_nest']);
});

test('§Issue1 identity gate — held at identity_name with neither field; advances on a name or an explicit skip', () => {
  // The deterministic core: nextStage cannot leave the naming beat until a field is set.
  assert.equal(nextStage({ athleticPast: 'x' }), 'identity_name', 'neither field set → held');
  assert.equal(nextStage({ athleticPast: 'x', identityNoun: 'Runner' }), 'reclaim', 'named → advances');
  assert.equal(nextStage({ athleticPast: 'x', identitySkipped: true }), 'reclaim', 'skipped → advances');

  // The live drive (pure): an explicit decline at the naming beat sets identitySkipped even if the
  // model failed to record it — so the member can always move on (the gate Donna's run lacked).
  const atBeat: Collected = { athleticPast: 'someone who rode at dawn' };
  const declined = resolveIdentityGate(atBeat, "honestly I'm not sure yet", 0);
  assert.equal(declined.atNamingBeat, true);
  assert.equal(declined.setSkipped, true, 'an explicit "not sure" skips');

  // A vague non-answer does NOT skip on its own — but after the engine has OFFERED the skip
  // (IDENTITY_SKIP_OFFER_AFTER turns), a bare "yeah" accepts the offer.
  const stillThinking = resolveIdentityGate(atBeat, 'hmm, let me think about that', 0); // identityTurns → 1
  assert.equal(stillThinking.setSkipped, false, 'not a decline — keep asking');
  assert.equal(stillThinking.offerSkip, false, 'too early to offer the skip');
  const offered = resolveIdentityGate(atBeat, 'still pondering', 1); // identityTurns → 2 (== offer-after)
  assert.equal(offered.offerSkip, true, 'after two tries the engine offers the explicit skip');
  const accepted = resolveIdentityGate(atBeat, 'yeah', 3); // identityTurns → 4 (> offer-after)
  assert.equal(accepted.setSkipped, true, 'a bare affirmation accepts the offered skip');

  // Once identity is captured, the gate is inert (a model that recorded a name wins).
  const past: Collected = { athleticPast: 'x', identityNoun: 'Runner' };
  const inert = resolveIdentityGate(past, 'skip', 5);
  assert.equal(inert.atNamingBeat, false);
  assert.equal(inert.setSkipped, false, 'not at the naming beat → never auto-skips');
});

test('§Donna reproduction — the full run that stalled at 71 turns now completes (identity skipped + Load-Bearer)', () => {
  // Donna failed BOTH: identity never captured AND her load-fade mapped to no Door. Pass A fixes both.
  const gap = 'When my husband semi-retired, I held the financial weight for the whole family and carried more than my fair share for a decade.';
  const doors = matchDoors(gap);
  assert.deepEqual(doors, ['load_bearer'], 'her load-fade now has a Door');

  // She declines to name the identity at the gate → identitySkipped via the pure drive.
  const atBeat: Collected = { athleticPast: 'the one who used to have her own plans' };
  assert.equal(resolveIdentityGate(atBeat, "I don't know, not yet", 1).setSkipped, true);

  const donna: Collected = {
    athleticPast: 'the one who used to have her own plans',
    identitySkipped: true,
    reclaimList: ['My own projects again', 'Time that is mine', 'Travel I choose'],
    gap,
    doors,
  };
  assert.equal(contractMet(donna), true, 'contract is satisfiable — the stall is gone');
  const res = resolveCompletion(donna as never, true, 3);
  assert.equal(res.complete, true, 'Donna completes');
  // And she persists: identity may be empty (skipped), the Door set is present.
  const fields = collectedToFields(ctx, donna);
  assert.equal(fields.identitySkipped, true);
  assert.equal(fields.identityNoun, '');
  assert.deepEqual(fields.doors, ['load_bearer']);
});

// ============================================================================
// Donna run 2 (Jun 18 2026) — a contract-met member who FRONT-LOADED a rich, multi-Door fade in one
// pass got trapped: doorTurns=1 < the explore-floor, so the engine kept asking "what else piled on?"
// and ignored her explicit "move me through to the IDQ." Two fixes: a rich/multi-Door story satisfies
// the floor, and an explicit request to advance is honored (member sovereignty).
// ============================================================================

const donnaGap =
  'Seven years ago her husband semi-retired without a conversation; she became the sole financial ' +
  'support, carrying the household and the debt while managing his emotional volatility. When she lost ' +
  'her own job he did not step up, and the affection disappeared. Around the same time her father went ' +
  'into a coma and she saw her mother\'s decline — the Cheerleader got buried in survival mode.';
const donna: Collected = {
  athleticPast: 'Optimistic, energetic, a problem-solver who lifts others up',
  identityNoun: 'Cheerleader',
  reclaimList: ['Reach out to friends regularly', 'Stop worrying about finances', 'A meaningful creative role'],
  gap: donnaGap,
  doors: ['aging_parents', 'marriage', 'grind', 'load_bearer'],
};

test('memberWantsToWrap honors an explicit request to advance (Donna: "move me through to the IDQ")', () => {
  for (const m of ['Can you move me through to the IDQ?', 'What\'s next?', 'move me to the IDQ', 'let\'s proceed', "I'm ready", 'take me through']) {
    assert.equal(memberWantsToWrap(m), true, `advance: "${m}"`);
  }
  // ...but a normal substantive answer is NOT a wrap.
  assert.equal(memberWantsToWrap('My father went into a coma that same year'), false);
});

test('a front-loaded rich multi-Door story completes without grinding out the turn-floor', () => {
  assert.equal(contractMet(donna), true, 'her contract is fully met');
  // doorTurns = 1 (she gave it all at once) — but the story is rich (4 Doors), so the floor is satisfied.
  // The model says "I have everything, let me close" (wantsComplete) → she completes, no extra widening.
  assert.equal(resolveCompletion(donna, /*wantsComplete*/ true, /*doorTurns*/ 1).complete, true);
  // And her explicit "move me through to the IDQ" (memberDone) completes it even if the model didn't flag.
  assert.equal(resolveCompletion(donna, false, 1, false, false, /*memberDone*/ true).complete, true);
});

test('the explore-floor still protects a THIN single-Door gap (no front-loaded story → it breathes)', () => {
  // A short, single-Door narrative is NOT "rich": the beat must still breathe so the model can check
  // whether more than one Door piled on. This is the original "explore first" guarantee, preserved.
  const thin: Collected = {
    athleticPast: 'x', identityNoun: 'Runner', reclaimList: ['a', 'b', 'c'],
    doors: ['career_cliff'], gap: 'my role was cut and the riding quietly stopped',
  };
  assert.equal(contractMet(thin), true);
  assert.equal(resolveCompletion(thin, /*wantsComplete*/ true, /*doorTurns*/ 1).complete, false, 'thin story still breathes below the floor');
  // ...but the member can still end it themselves at any time (Independence Guarantee).
  assert.equal(resolveCompletion(thin, false, 1, false, false, /*memberDone*/ true).complete, true);
});

test('gap-capture backstop: the member\'s own door-beat narrative is captured when the model fails to record it', () => {
  // Donna's run: she told her whole fade, the agent reflected it, but the model never wrote `gap` —
  // so the engine looped on "how did the gap open?". The backstop reads her account at the Door beat.
  const atDoorBeat: Collected = { athleticPast: 'x', identityNoun: 'Cheerleader', reclaimList: ['a', 'b', 'c'] };
  assert.equal(nextStage(atDoorBeat), 'door', 'identity + reclaim done, no gap yet → at the Door beat');
  assert.equal(shouldCaptureGapFromMessage(atDoorBeat, donnaGap), true, 'a real fade narrative is captured');
  // ...and once captured, the contract is met.
  assert.equal(contractMet({ ...atDoorBeat, gap: donnaGap }), true);

  // It does NOT fire on a non-narrative (a protest / proceed request) — no gap fabricated from those.
  assert.equal(shouldCaptureGapFromMessage(atDoorBeat, "What's next?"), false);
  assert.equal(shouldCaptureGapFromMessage(atDoorBeat, 'it seems like you are hung up'), false);
  // It does NOT fire OFF the Door beat (still gathering the Reclaim List) — a narrative there isn't the gap.
  assert.equal(shouldCaptureGapFromMessage({ athleticPast: 'x', identityNoun: 'C', reclaimList: ['a'] }, donnaGap), false);
  // It does NOT capture a reclaim item restated (gapIsNarrative rejects it) — the old fabrication guard holds.
  assert.equal(shouldCaptureGapFromMessage({ ...atDoorBeat, reclaimList: ['a', 'b', donnaGap] }, donnaGap), false);
});
