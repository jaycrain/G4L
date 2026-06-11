import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkinOpening, checkinReply, proactiveTeaser, contextBlock, type CheckinContext } from '../lib/agent/checkin.ts';

const base: CheckinContext = {
  displayName: 'Tom Miller',
  identityNoun: 'Athlete',
  doorDisplayNames: ['The Career Cliff', 'The Body'],
  idScore: 60,
  direction: 'up',
  currentFocus: 'Rebuild — your body',
  lastCompletedAsset: 'Identity Excavation',
  reclaimList: ['ride again'],
};

const BANNED = [/\bjourney\b/i, /\bI hear you\b/i, /\bamazing\b/i];
const clean = (s: string) => BANNED.every((re) => !re.test(s));

test('first opening shows it knows the member (identity + what they want back), not a dashboard rehash', async () => {
  const r = await checkinOpening(base); // no key in test env → scripted
  assert.match(r, /Tom/); // by name
  assert.match(r, /Athlete/); // their reclaimed identity
  assert.match(r, /ride again/i); // a concrete Reclaim item
  assert.ok(clean(r), 'opening must respect banned-phrase voice rules');
});

test('a crisis disclosure routes to 988 and is flagged', async () => {
  const r = await checkinReply(base, [], 'honestly I want to die some days');
  assert.equal(r.crisis, true);
  assert.match(r.reply, /988/);
});

test('scripted replies are reflective, brand-safe, and bridge wins toward people', async () => {
  const win = await checkinReply(base, [], 'I finally rode 10 miles, so proud');
  assert.match(win.reply, /who else|hear it/i); // bridges toward a person
  assert.ok(clean(win.reply));

  const vent = await checkinReply(base, [], 'feeling lonely and stuck this week');
  assert.ok(vent.reply.length > 0);
  assert.ok(clean(vent.reply));
});

test('contextBlock surfaces the full member data the MA can speak to', () => {
  const block = contextBlock({
    ...base,
    dimensions: { physical: 14, self: 22, social: 18, outlook: 20 },
    idScoreHistory: [60, 67],
    idqAnswers: [{ dimension: 'physical', stem: 'Your body feels like it belongs to you.', score: 2 }],
    reclaimDetail: [{ text: 'ride again', category: 'physical', state: 'closer' }],
    beatsDone: 5,
  });
  assert.match(block, /Physical 14/); // dimension subscores
  assert.match(block, /60 → 67/); // trend
  assert.match(block, /Your body feels like it belongs to you\. — 2/); // a specific IDQ answer
  assert.match(block, /ride again \[physical\] — closer/); // Reclaim item + progress
  assert.match(block, /Beats worked so far: 5/);
});

test('proactiveTeaser is signal-driven', () => {
  assert.match(proactiveTeaser({ ...base, idScore: null }), /IDQ/);
  assert.match(proactiveTeaser({ ...base, lastCompletedAsset: 'Fuel Plan' }), /Fuel Plan/);
  assert.match(proactiveTeaser({ ...base, lastCompletedAsset: null, direction: 'up' }), /working/);
  assert.match(proactiveTeaser({ ...base, lastCompletedAsset: null, direction: null }), /landing/);
});
