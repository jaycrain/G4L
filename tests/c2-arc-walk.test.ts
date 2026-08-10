import './helpers/with-phase-flags.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReclaimC2Turn, reclaimC2Opening } from '../lib/agent/reclaim.ts';
import { AUDIT_ITEM_COUNT, AUDIT_SORT_QUESTIONS } from '../lib/reclaim/bigger-world-instrument.ts';
import type { ConvState, Turn } from '../lib/agent/onboarding.ts';

// WALKING C2 END TO END.
//
// The arc is now nine stages — four (ratings → reflection) pairs plus the cross-domain sort — where it used to be
// one administered block. Unit tests on the pieces would all pass with the stages wired in the wrong order, or with
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

/** Ratings for one domain, then "next" three times to skip its reflection. */
const ratings = (n: number): string[] => Array.from({ length: 5 }, () => String(n));
const skipReflection = ['next', 'next', 'next'];

test('a full walk completes: 20 ratings + 4 reflections + 5 sort answers', () => {
  const answers = [
    ...ratings(3), ...skipReflection,
    ...ratings(4), ...skipReflection,
    ...ratings(5), ...skipReflection,
    ...ratings(6), ...skipReflection,
    'physical', 'self', 'social', 'outlook', 'self',
  ];
  const { final } = walk(answers);
  assert.equal(final.complete, true, 'the arc completes');
  assert.match(final.reply, /best next focus/i);
});

test('the arc does NOT complete early — the old single stage finished at 20 ratings', () => {
  // The regression this guards: if the cumulative itemCounts were wrong, the first domain's five answers would
  // satisfy a 5-item stage AND the arc would run the completion closure immediately.
  const { final } = walk([...ratings(3)]);
  assert.equal(final.complete, false, 'five ratings is not the end of the audit');
  assert.match(final.reply, /biggest difference|physically/i, 'it hands into the PHYSICAL reflection');
});

test('reflections are asked between domains, not all at the end', () => {
  // After five ratings the next question must be a reflection, and after the three reflections the next must be a
  // rating again. That ordering IS Greg's design — reflect while the domain is still live.
  const { turns } = walk([...ratings(3), 'I stopped moving', 'Evenings get away from me', 'Walk at lunch']);
  const afterRatings = turns[5]!.reply; // the 5th answer's reply
  assert.match(afterRatings, /biggest difference/i, 'reflection follows the ratings');
  assert.match(turns.at(-1)!.reply, /1 to 10|rate yourself/i, 'and then we are back to rating the NEXT domain');
});

test('the member’s words are captured, and a skip captures nothing', () => {
  const answers = [
    ...ratings(3), 'I stopped moving entirely', 'next', 'Walk at lunch',
    ...ratings(4), ...skipReflection,
    ...ratings(5), ...skipReflection,
    ...ratings(6), ...skipReflection,
    'physical', 'physical', 'physical', 'physical', 'physical',
  ];
  const { final } = walk(answers);
  const refl = (final.state as ConvState).collected.auditReflections!;
  assert.equal(refl.domains.physical?.gapNote, 'I stopped moving entirely');
  assert.equal(refl.domains.physical?.earlyAction, 'Walk at lunch');
  assert.equal('obstacle' in (refl.domains.physical ?? {}), false, 'the skipped obstacle is ABSENT, not ""');
});

test('a named sub-issue is recorded — and only when the member actually said it', () => {
  const answers = [
    ...ratings(3), 'Mostly sleep, and my nutrition is a mess', 'next', 'next',
    ...ratings(4), ...skipReflection,
    ...ratings(5), ...skipReflection,
    ...ratings(6), ...skipReflection,
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
    ...ratings(3), 'physical gap', 'physical obstacle', 'physical action',
    ...ratings(4), 'self gap', 'self obstacle', 'self action',
    ...ratings(5), ...skipReflection,
    ...ratings(6), ...skipReflection,
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
    ...physicalHeavy, ...skipReflection,
    ...flat, ...skipReflection,
    ...flat, 'People drifted', 'I cancel a lot', 'Call my brother',
    ...flat, ...skipReflection,
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
    ...ratings(1), ...skipReflection,
    ...ratings(2), ...skipReflection,
    ...ratings(3), ...skipReflection,
    ...ratings(4), ...skipReflection,
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
    ...ratings(3), 'sleep and nutrition', 'physical obstacle', 'physical action',
    ...ratings(4), ...skipReflection,
    ...ratings(5), 'people drifted', 'I cancel a lot', 'Call my brother',
    ...ratings(6), ...skipReflection,
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
