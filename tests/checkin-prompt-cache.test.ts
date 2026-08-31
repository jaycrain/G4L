import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkinSystem, checkinSystemBlocks } from '../lib/agent/checkin.ts';
import type { CheckinContext } from '../lib/agent/checkin.ts';

// THE HIGHEST-VOLUME MODEL CALL IN THE PRODUCT — every check-in turn, every day, every member — was re-sending
// ~10,000 tokens of unchanging instructions on each one. Measured against the live API after the split:
//
//   1st call → cache_creation 10,049 · cache_read      0 · uncached 47
//   2nd call → cache_creation      0 · cache_read 10,049 · uncached 47
//
// Nothing about the prompt's CONTENT changed. Only how it is transported.

const ctx = (over: Partial<CheckinContext> = {}): CheckinContext =>
  ({ displayName: 'Donna', identityNoun: 'Maker', doorDisplayNames: ['Career Cliff'],
     reclaimList: [], recentMoments: [], ...over }) as CheckinContext;

test('LOSSLESS: the blocks joined are exactly the prompt the agent used to receive', () => {
  // The whole point of the refactor is that the model reads the same thing. A caching change that also edits the
  // prompt is two changes wearing one commit, and the second one would be invisible.
  for (const c of [ctx(), ctx({ displayName: '' }), ctx({ identityNoun: '' })]) {
    assert.equal(checkinSystemBlocks(c).map((b) => b.text).join(''), checkinSystem(c));
  }
});

test('the CACHE MARKER sits on the stable half only', () => {
  const [stable, member] = checkinSystemBlocks(ctx());
  assert.equal(stable!.cache_control?.type, 'ephemeral', 'the reusable prefix is marked');
  assert.equal(member!.cache_control, undefined,
    'the member half changes every turn — caching it would be a write that is never read');
});

test('the stable half is genuinely IDENTICAL across members — otherwise nothing is reused', () => {
  const a = checkinSystemBlocks(ctx({ displayName: 'Donna', identityNoun: 'Maker' }))[0]!.text;
  const b = checkinSystemBlocks(ctx({ displayName: 'Greg', identityNoun: 'Runner' }))[0]!.text;
  assert.equal(a, b, 'a member detail leaking into the cached half breaks the cache for everyone');
});

test('the member half carries the facts, and the stable half carries none of them', () => {
  const [stable, member] = checkinSystemBlocks(ctx({ displayName: 'Donna' }));
  // The HEADER, not the phrase. The instructions legitimately refer to "MEMBER CONTEXT tells you…" by name, so a
  // bare substring check fails on correct code — my own first version of this assertion did exactly that.
  assert.match(member!.text, /MEMBER CONTEXT \(facts/, 'the facts block lives in the uncached half');
  assert.ok(!/MEMBER CONTEXT \(facts/.test(stable!.text), 'and its header is not in the cached one');
  assert.ok(!stable!.text.includes('Donna'), 'no member name may reach the shared prefix');
  assert.ok(!stable!.text.includes('Career Cliff'), 'nor any of her Doors');
});

test('the cached prefix clears the 1024-token floor by a wide margin', () => {
  // Below the minimum the marker is silently ignored and the whole change does nothing — the failure mode this
  // test exists to make visible if the prompt is ever cut down.
  const approxTokens = checkinSystemBlocks(ctx())[0]!.text.length / 4;
  assert.ok(approxTokens > 4000, `cached prefix ~${Math.round(approxTokens)} tokens — too small to be worth caching`);
});
