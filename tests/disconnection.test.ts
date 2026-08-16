// THE ENGINE NOTICES; THE MODEL SPEAKS. Tests for lib/agent/disconnection.ts.
//
// Donna's record, 2026-08-16, is the case this exists for and the first test below is her actual shape.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDisconnections, disconnectionContext, weakestDimension } from '../lib/agent/disconnection.ts';

/** Donna's real profile: ID Score 60.83, a 14-point spread, and a list with no Self item. */
const DONNA = {
  dimensions: { physical: 16, self: 11, social: 25, outlook: 21 },
  identityNoun: 'the Problem-Solver',
  items: [
    { text: 'a creative role that pays the bills', category: 'life' },
    { text: 'get back to 165 pounds', category: 'physical' },
    { text: "peace and stability that don't feel like they're always in jeopardy", category: 'outlook' },
  ],
};

test("THE CASE: Donna's shape produces exactly one notice, and it is the identity one", () => {
  const found = findDisconnections(DONNA);
  assert.equal(found.length, 1, 'ONE finding — her weakest dimension IS self, so this is not two things');
  assert.equal(found[0]!.kind, 'identity');
  assert.match(found[0]!.material, /Problem-Solver/, 'it speaks from what she actually named');
});

test('the notice never contains a number — the score is a trigger, never a sentence', () => {
  const ctx = disconnectionContext(DONNA);
  assert.ok(ctx);
  assert.equal(/\d/.test(ctx!.line), false, 'no digit may reach the model in this line');
  assert.equal(/IDQ|ID Score|dimension|score/i.test(ctx!.material ?? ''), false, 'and no instrument is named');
});

test("'life' covers no dimension — the most common list shape must not suppress everything", () => {
  // Donna's top item is 'life'. If life counted as coverage this whole feature would go quiet on real members.
  const allLife = {
    dimensions: { physical: 9, self: 20, social: 20, outlook: 20 },
    items: [{ text: 'a creative role that pays', category: 'life' }],
  };
  const found = findDisconnections(allLife);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.kind, 'dimension');
  assert.equal(found[0]!.subject, 'physical', 'the weakest dimension is still uncovered');
});

test('a covered weakest dimension is silent — this fires on a real gap, not on everyone', () => {
  const covered = {
    dimensions: { physical: 9, self: 20, social: 20, outlook: 20 },
    items: [{ text: 'ride to Brainard before work', category: 'physical' }],
  };
  assert.equal(findDisconnections(covered).length, 0);
  assert.equal(disconnectionContext(covered), null);
});

test('an empty list is silent — a member with no list yet is not disconnected, just early', () => {
  assert.equal(
    findDisconnections({ dimensions: { physical: 9, self: 9, social: 9, outlook: 9 }, identityNoun: 'the Runner', items: [] })
      .length,
    0,
    'nothing to be disconnected FROM',
  );
});

test('RAISE ONCE: an already-raised finding never returns', () => {
  const first = findDisconnections(DONNA);
  assert.equal(first.length, 1);
  const second = findDisconnections({
    ...DONNA,
    alreadyRaised: [{ kind: first[0]!.kind, subject: first[0]!.subject }],
  });
  assert.equal(second.length, 0, 'her answer settled it — permanently');
});

test('but a genuinely DIFFERENT disconnection can still surface later', () => {
  // Keyed on subject, not just kind. She answers the identity one; later her list changes and a different area
  // opens up. That is a new observation, not a re-raise of a settled one.
  const laterHerListChanged = {
    dimensions: { physical: 8, self: 11, social: 25, outlook: 21 },
    identityNoun: 'the Problem-Solver',
    items: [{ text: 'run my own studio', category: 'self' }], // self now covered; physical now weakest + bare
    alreadyRaised: [{ kind: 'identity', subject: 'the problem-solver' }],
  };
  const found = findDisconnections(laterHerListChanged);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.kind, 'dimension');
  assert.equal(found[0]!.subject, 'physical');
});

test('a commitment that serves nothing is noticed, and phrased without accusation', () => {
  const found = findDisconnections({
    items: [{ text: 'get back to 165 pounds', category: 'physical' }],
    commitments: [
      { text: 'walk 20 minutes after dinner', serves: 'get back to 165 pounds' },
      { text: 'stretch before bed', serves: null },
    ],
  });
  assert.equal(found.length, 1);
  assert.equal(found[0]!.kind, 'commitment');
  assert.match(found[0]!.material, /stretch before bed/);
  assert.match(found[0]!.material, /which is fine/, 'never framed as a fault — it may just serve their health');
});

test('at most ONE reaches the model per turn, even when several are true', () => {
  const many = {
    dimensions: { physical: 7, self: 8, social: 9, outlook: 10 },
    identityNoun: 'the Runner',
    items: [{ text: 'a job that pays', category: 'life' }],
    commitments: [{ text: 'stretch before bed', serves: null }],
  };
  assert.ok(findDisconnections(many).length > 1, 'precondition: several are genuinely true');
  const ctx = disconnectionContext(many);
  assert.ok(ctx);
  assert.equal(ctx!.raised.kind, 'identity', 'the one in her own words wins');
  assert.equal((ctx!.line.match(/SOMETHING DOESN'T CONNECT/g) ?? []).length, 1, 'exactly one observation');
});

test('weakestDimension is deterministic on ties', () => {
  const tied = { physical: 12, self: 12, social: 12, outlook: 12 };
  assert.equal(weakestDimension(tied), 'physical');
  assert.equal(weakestDimension(tied), weakestDimension(tied), 'same input, same answer, always');
});

test('reclaimed items do not count as coverage — a finished goal is not a live one', () => {
  const finished = {
    dimensions: { physical: 9, self: 20, social: 20, outlook: 20 },
    items: [{ text: 'ran a 5k', category: 'physical', state: 'reclaimed' }],
  };
  const found = findDisconnections(finished);
  assert.equal(found.length, 1, 'the area is bare again once the goal in it is complete');
  assert.equal(found[0]!.subject, 'physical');
});

// ── THE SEAM ──────────────────────────────────────────────────────────────────────────────────────────────────
// The pure function above is worthless if the line never reaches the model, and worse than worthless if it does
// reach the model with a number in it. Test the seam, not the halves.

import { checkinSystem } from '../lib/agent/checkin.ts';

const base = {
  displayName: 'Donna', identityNoun: 'the Problem-Solver', doorDisplayNames: [], idScore: 61,
  direction: null, currentFocus: 'self', lastCompletedAsset: null, reclaimList: [],
} as never;

test('SEAM: the disconnection line reaches the assembled check-in prompt', () => {
  const line = disconnectionContext(DONNA)!.line;
  const sys = checkinSystem({ ...(base as object), disconnection: line } as never);
  assert.ok(sys.includes(line), 'the whole computed line is present, not a paraphrase');
  assert.ok(sys.includes('Problem-Solver'), 'and it carries her own words into the prompt');
});

test('SEAM: no disconnection → nothing about it appears at all', () => {
  const sys = checkinSystem({ ...(base as object), disconnection: null } as never);
  assert.equal(/SOMETHING DOESN'T CONNECT/.test(sys), false, 'silence is the default, not an empty header');
});

test('SEAM: it lands AFTER the member facts, so it cannot read as the agenda', () => {
  const line = disconnectionContext(DONNA)!.line;
  const sys = checkinSystem({ ...(base as object), disconnection: line } as never);
  assert.ok(sys.indexOf('Member: Donna') < sys.indexOf("SOMETHING DOESN'T CONNECT"),
    'their own history is read first');
});

test('SEAM: the purpose statement that asks for this is in the same prompt', () => {
  // The instruction ("hold the whole picture") and the mechanism that makes it reliable must travel together.
  // If the statement were ever scoped away from this surface, the engine would compute a notice nothing asked for.
  const line = disconnectionContext(DONNA)!.line;
  const sys = checkinSystem({ ...(base as object), disconnection: line } as never);
  assert.ok(sys.includes('HOLD THE WHOLE PICTURE'), 'the duty is stated');
  assert.ok(sys.includes("SOMETHING DOESN'T CONNECT"), 'and the specific instance is supplied');
});
