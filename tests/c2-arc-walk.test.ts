import './helpers/with-phase-flags.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReclaimC2Turn, reclaimC2Opening } from '../lib/agent/reclaim.ts';
import { AUDIT_ITEM_COUNT, AUDIT_ITEMS, AUDIT_REFLECTION_PROMPTS, AUDIT_SORT_QUESTIONS } from '../lib/reclaim/bigger-world-instrument.ts';
import type { ConvState, Turn } from '../lib/agent/onboarding.ts';

// WALKING C2 END TO END.
//
// The arc is now seventeen stages — four (rate → Q3 → rate → Q7/Q8) runs plus the cross-domain sort — where it used
// to be one administered block. Unit tests on the pieces would all pass with the stages wired in the wrong order, or with
// the shared response bag mis-counted, or with the reflection's step counter leaking from one domain into the next.
// The only way to know is to walk it. (Jennifer's infinite loop was dead code that every unit test passed.)

// STATE IS SERIALISED BETWEEN EVERY TURN, deliberately. Live, the state goes out to the client and comes back as
// JSON on the next request (and through jsonb if the session is resumed), so passing the object straight through —
// which this helper used to do — tests a path no member takes. Anything that survives only by object identity, or
// any Map/Set/undefined-vs-absent subtlety, is invisible without this. It costs one JSON.parse per turn.
const overTheWire = (s: ConvState): ConvState => JSON.parse(JSON.stringify(s)) as ConvState;

function walk(answers: string[]): { turns: Turn[]; final: Turn } {
  let t = reclaimC2Opening();
  const turns: Turn[] = [t];
  for (const a of answers) {
    t = applyReclaimC2Turn(overTheWire(t.state as ConvState), [], a);
    turns.push(t);
  }
  return { turns, final: t };
}

/** Ratings for one domain. */
const ratings = (n: number): string[] => Array.from({ length: 5 }, () => String(n));
/** Q1–Q2 only — the first administered chunk, which hands into Q3. */
const rateA = (n: number): string[] => [String(n), String(n)];
// V4's reflection questions are REQUIRED — "next" no longer advances (Jay, 2026-08-09: the completeness of a
// validated instrument is Greg's call, not ours). These stand in for a member who answers briefly.
const answerReflection = ['a gap', 'an obstacle', 'a first move'];

/**
 * ONE DOMAIN IN GREG'S ORDER: Q1, Q2 → Q3 (the gap) → Q4, Q5, Q6 → Q7, Q8.
 *
 * Every walk below composes domains through this helper rather than spelling the sequence out, so the order lives in
 * ONE place. When we had the five ratings in a block and the three reflections after them, each test carried its own
 * copy of that order and the reorder would have meant editing eight sequences by hand — the shape that reliably
 * leaves one of them wrong.
 */
function domain(rate: number | string[], refl: string[] = answerReflection): string[] {
  const r = typeof rate === 'number' ? ratings(rate) : rate;
  return [r[0]!, r[1]!, refl[0]!, r[2]!, r[3]!, r[4]!, refl[1]!, refl[2]!];
}

test('a full walk completes: 20 ratings + 12 reflections + 5 sort answers', () => {
  const answers = [
    ...domain(3),
    ...domain(4),
    ...domain(5),
    ...domain(6),
    'physical', 'self', 'social', 'outlook', 'self',
  ];
  const { final } = walk(answers);
  assert.equal(final.complete, true, 'the arc completes');
  assert.match(final.reply, /best next focus/i);
});

test('the arc does NOT complete early — the old single stage finished at 20 ratings', () => {
  // The regression this guards: if the cumulative itemCounts were wrong, the first domain's five answers would
  // satisfy a 5-item stage AND the arc would run the completion closure immediately.
  const { final } = walk([...domain(3)]);
  assert.equal(final.complete, false, 'one domain is not the end of the audit');
  assert.match(final.reply, /1 to 10|rate yourself/i, 'it hands into the NEXT domain’s ratings');
});

test('GREG’S ORDER: Q1,Q2 → Q3 → Q4,Q5,Q6 → Q7,Q8 — the gap sits INSIDE the ratings', () => {
  // The order is part of the instrument, not presentation. In V4 the member puts the gap into words at Q3 and THEN
  // rates importance/readiness/ripple against it. We had all five ratings first and Q3→Q7→Q8 after, which asked them
  // to score a gap they had not articulated and then describe it twice, back to back — the pair Jay hit on his walk
  // ("this Session was odd, it actually kind of sucked"). This test is what stops it drifting back.
  const { turns } = walk([...domain(3, ['I stopped moving', 'Evenings get away from me', 'Walk at lunch'])]);
  // turns[0] is the opener; turns[n] is the reply to the nth answer. Asserting against the instrument's own item
  // text rather than a "is this a rating?" regex — the items don't all mention the scale, and a regex loose enough
  // to match them all would also match the reflections, which is a check that can't fail.
  const item = (n: number) => AUDIT_ITEMS[n]!.prompt;
  const reply = (i: number) => turns[i]!.reply;
  const q = AUDIT_REFLECTION_PROMPTS.physical;

  assert.ok(reply(0).includes(item(0)), 'Q1 Current opens');
  assert.ok(reply(1).includes(item(1)), 'Q2 Desired follows');
  assert.ok(reply(2).includes(q.gap), 'Q3 the GAP lands after two ratings, not five');
  assert.ok(reply(3).includes(item(2)), 'and hands straight BACK to Q4 Importance — rated against the named gap');
  assert.ok(reply(4).includes(item(3)), 'Q5 Readiness');
  assert.ok(reply(5).includes(item(4)), 'Q6 Ripple');
  assert.ok(reply(6).includes(q.obstacle), 'Q7 Obstacle comes after the ratings');
  assert.equal(reply(6).includes(q.gap), false, 'never two describe-the-gap questions back to back');
  assert.ok(reply(7).includes(q.action), 'Q8 Early action');
  assert.ok(reply(8).includes(item(5)), 'then the NEXT domain begins at its own Q1');
});

test('every one of the member’s words is captured, in the right slot', () => {
  const answers = [
    ...domain(3, ['I stopped moving entirely', 'Evenings vanish', 'Walk at lunch']),
    ...domain(4),
    ...domain(5),
    ...domain(6),
    'physical', 'physical', 'physical', 'physical', 'physical',
  ];
  const { final } = walk(answers);
  const refl = (final.state as ConvState).collected.auditReflections!;
  assert.equal(refl.domains.physical?.gapNote, 'I stopped moving entirely');
  assert.equal(refl.domains.physical?.obstacle, 'Evenings vanish');
  assert.equal(refl.domains.physical?.earlyAction, 'Walk at lunch');
});

test('a named sub-issue is recorded — and only when the member actually said it', () => {
  const answers = [
    ...domain(3, ['Mostly sleep, and my nutrition is a mess', 'no time', 'walk more']),
    ...domain(4),
    ...domain(5),
    ...domain(6),
    'physical', 'physical', 'physical', 'physical', 'physical',
  ];
  const { final } = walk(answers);
  const subs = (final.state as ConvState).collected.auditReflections!.domains.physical?.subIssues ?? [];
  assert.deepEqual(subs.sort(), ['Nutrition', 'Sleep'], 'his labels, matched from their own sentence');
  assert.equal(subs.includes('Strength'), false, 'nothing they did not say');
});

test('the reflection step counter RESETS between domains', () => {
  // The obvious bug in a shared scratch: domain two's reflection starts at Q7 because domain one left the counter
  // at 2. Then every later domain records the wrong field and the walk finishes early.
  const answers = [
    ...domain(3, ['physical gap', 'physical obstacle', 'physical action']),
    ...domain(4, ['self gap', 'self obstacle', 'self action']),
    ...domain(5),
    ...domain(6),
    'self', 'self', 'self', 'self', 'self',
  ];
  const { final } = walk(answers);
  const d = (final.state as ConvState).collected.auditReflections!.domains;
  assert.equal(d.self?.gapNote, 'self gap', 'domain two started at Q3, not mid-sequence');
  assert.equal(d.self?.obstacle, 'self obstacle');
  assert.equal(d.self?.earlyAction, 'self action');
});

test('THE DIVERGENCE READS AS REFLECTION, NOT CORRECTION', () => {
  // Ratings that make Physical the runaway computed Primary; member chooses Social.
  const physicalHeavy = ['2', '10', '10', '3', '8'];
  const flat = ['7', '8', '4', '9', '4'];
  const answers = [
    ...domain(physicalHeavy),
    ...domain(flat),
    ...domain(flat, ['People drifted', 'I cancel a lot', 'Call my brother']),
    ...domain(flat),
    'physical', 'social', 'social', 'social', 'social',
  ];
  const { final } = walk(answers);
  assert.match(final.reply, /Social life/i, 'the close leads with what the member chose');
  assert.match(final.reply, /ratings leaned toward Physical/i, 'and names the divergence plainly');
  assert.doesNotMatch(final.reply, /should|instead you|actually/i, 'never as a correction');
  assert.match(final.reply, /I cancel a lot/, 'Key Obstacle is their words, from the domain they chose');
  assert.match(final.reply, /Call my brother/, 'and so is First Action');
});

test('all 20 ratings survive the split — the bag is not reset between domains', () => {
  const answers = [
    ...domain(1),
    ...domain(2),
    ...domain(3),
    ...domain(4),
    ...AUDIT_SORT_QUESTIONS.map(() => 'self'),
  ];
  const { final } = walk(answers);
  const st = final.state as ConvState & { administeredResponses?: number[] };
  const bag = st.administeredResponses ?? [];
  assert.equal(bag.length, AUDIT_ITEM_COUNT, 'twenty ratings reached the end intact');
  assert.deepEqual(bag.slice(0, 5), [1, 1, 1, 1, 1], 'domain one’s answers are still first');
  assert.deepEqual(bag.slice(15), [4, 4, 4, 4, 4], 'domain four’s are last');
});

test('EVERY answer survives the whole arc — reflections are not wiped by the rating stages between them', () => {
  // The shape this guards is the one a browser walk could not settle: a domain's reflection is followed by the NEXT
  // domain's five administered ratings, and administered turns run off the depth kernel on a different code path.
  // If `collected` did not carry across that boundary, each domain's answers would vanish as soon as the next
  // domain started — and the close would quietly have less to say, which reads as "the member skipped it".
  const answers = [
    ...domain(3, ['sleep and nutrition', 'physical obstacle', 'physical action']),
    ...domain(4),
    ...domain(5, ['people drifted', 'I cancel a lot', 'Call my brother']),
    ...domain(6),
    'physical', 'physical', 'social', 'physical', 'social',
  ];
  const { final } = walk(answers);
  const r = (final.state as ConvState).collected.auditReflections!;

  // Physical was captured FIRST and had to survive fifteen later ratings plus two other reflections.
  assert.equal(r.domains.physical?.obstacle, 'physical obstacle');
  assert.equal(r.domains.physical?.earlyAction, 'physical action');
  assert.deepEqual(r.domains.physical?.subIssues?.sort(), ['Nutrition', 'Sleep']);
  assert.equal(r.domains.social?.earlyAction, 'Call my brother');

  // And every sort answer accumulates — not just the last one written.
  assert.deepEqual(r.sort, {
    costliest: 'physical', identity: 'physical', readiest: 'social', ripple: 'physical', focus: 'social',
  });
  assert.equal(final.complete, true);
});

test('A REFLECTION CANNOT BE SKIPPED — "next" re-asks instead of advancing', () => {
  // The instrument's completeness belongs to the person who validated it. We briefly allowed a skip because 32
  // questions sat awkwardly against Greg's 15-minute note; that was our judgement substituted for his.
  const { final } = walk([...rateA(3), 'next']);
  assert.equal(final.complete, false);
  assert.match(final.reply, /biggest difference/i, 'the SAME question comes back');
  const refl = (final.state as ConvState).collected.auditReflections;
  assert.equal(refl?.domains?.physical?.gapNote, undefined, 'and "next" is never stored as their answer');
});

test('an empty answer re-asks, and never stores a blank', () => {
  const { final } = walk([...rateA(3), '   ']);
  assert.equal(final.complete, false);
  assert.equal((final.state as ConvState).collected.auditReflections?.domains?.physical, undefined);
});

test('AFTER REPEATED NON-ANSWERS THE WAY OUT IS NAMED — required, but never a trap', () => {
  // The Independence Guarantee survives the removal of the skip. A question that can only be answered, with no
  // stated exit, is a trap — so after a few tries we say plainly that they can leave and their place is saved.
  // This is the administered loop's CAT-31 lesson, reused.
  const { final } = walk([...rateA(3), 'next', 'next', 'next']);
  assert.match(final.reply, /come back whenever you like|place is saved/i, 'the exit is stated');
  assert.match(final.reply, /biggest difference/i, 'and the question is still the one being asked');
  assert.equal(final.complete, false, 'it never advances on a non-answer');
});

test('"no" and "nothing" are ANSWERS, not refusals', () => {
  // Narrow on purpose: to "anything specific?" or "what gets in the way?", these are real replies. Treating them
  // as non-answers would be the same error as treating the question as optional — deciding a member's words
  // don't count.
  const { final } = walk([...domain(3, ['nothing specific comes to mind', 'no', 'walk at lunch'])]);
  const d = (final.state as ConvState).collected.auditReflections?.domains?.physical;
  assert.equal(d?.gapNote, 'nothing specific comes to mind');
  assert.equal(d?.obstacle, 'no');
  assert.equal(d?.earlyAction, 'walk at lunch');
});

test('THE SORT NEVER ADVANCES ON A NON-ANSWER — a question is not a pick', () => {
  // It used to advance regardless of whether a domain was parsed, so "what do you mean by identity?" lost that
  // question outright and moved on. Five sort answers feed the Primary read; a silently dropped one changes the
  // close and nothing tells anybody. Same rule the reflections already had, at the one stage that lacked it.
  const answers = [...domain(3), ...domain(4), ...domain(5), ...domain(6), 'what do you mean by identity?'];
  const { final } = walk(answers);
  assert.equal(final.complete, false, 'it does not run on to the next sort question');
  assert.ok(final.reply.includes(AUDIT_SORT_QUESTIONS[0]!.prompt), 'the SAME question comes back');
  assert.match(final.reply, /Physical, Self, Social, or Outlook/, 'with the four named — our wording, not their failure');
  const sort = (final.state as ConvState).collected.auditReflections?.sort;
  assert.equal(sort?.costliest, undefined, 'and nothing is stored from a non-answer');
});

test('the sort names the way out after repeated non-answers', () => {
  const answers = [...domain(3), ...domain(4), ...domain(5), ...domain(6), 'hmm', 'not sure', 'I really cannot say'];
  const { final } = walk(answers);
  assert.match(final.reply, /place is saved|come back whenever you like/i, 'the exit is stated');
  assert.equal(final.complete, false);
});

test('THE SECONDARY PRIORITY IS SAID OUT LOUD — computed since C2 shipped, never surfaced', () => {
  // Twenty ratings produced exactly one named domain. V4 reads out a Primary and a Secondary.
  const answers = [
    ...domain(['9', '9', '9', '9', '9']),   // physical — flat, low priority (no gap)
    ...domain(['2', '10', '10', '2', '10']), // self — big gap, high importance/ripple, low readiness
    ...domain(['5', '8', '8', '9', '5']),    // social — moderate gap, most ready
    ...domain(['6', '7', '4', '4', '4']),    // outlook — small
    'self', 'self', 'social', 'self', 'self',
  ];
  const { final } = walk(answers);
  assert.match(final.reply, /Second in line is/, 'the second-ranked domain is named');
  assert.doesNotMatch(final.reply, /take on now|instead/i, 'as a read, never an instruction');
});

test('the secondary is NOT repeated when it is already in the sentence', () => {
  // A close that names the same domain twice reads as a list, not a read. Suppression is the point of the rule.
  const answers = [
    ...domain(['2', '10', '10', '10', '10']), // physical — runaway primary AND most ready
    ...domain(['7', '7', '3', '3', '3']),
    ...domain(['7', '7', '3', '3', '3']),
    ...domain(['7', '7', '3', '3', '3']),
    'physical', 'physical', 'physical', 'physical', 'physical',
  ];
  const { final } = walk(answers);
  const hits = final.reply.match(/Physical/g) ?? [];
  assert.ok(hits.length <= 2, `Physical is not repeated across three clauses (saw ${hits.length})`);
});
