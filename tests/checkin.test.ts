import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkinOpening, checkinReply, proactiveTeaser, type CheckinContext } from '../lib/agent/checkin.ts';

const base: CheckinContext = {
  displayName: 'Tom Miller',
  identityNoun: 'ATHLETE',
  doorDisplayName: 'The Career Cliff',
  idScore: 60,
  direction: 'up',
  currentFocus: 'Rebuild — your body',
  lastCompletedAsset: 'Identity Excavation',
  reclaimList: ['ride again'],
};

const BANNED = [/\bjourney\b/i, /\bI hear you\b/i, /\bamazing\b/i];
const clean = (s: string) => BANNED.every((re) => !re.test(s));

test('scripted opening greets by first name and references the recent asset', async () => {
  const r = await checkinOpening(base); // no key in test env → scripted
  assert.match(r, /Tom/);
  assert.match(r, /Identity Excavation/);
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

test('proactiveTeaser is signal-driven', () => {
  assert.match(proactiveTeaser({ ...base, idScore: null }), /IDQ/);
  assert.match(proactiveTeaser({ ...base, lastCompletedAsset: 'Fuel Plan' }), /Fuel Plan/);
  assert.match(proactiveTeaser({ ...base, lastCompletedAsset: null, direction: 'up' }), /working/);
  assert.match(proactiveTeaser({ ...base, lastCompletedAsset: null, direction: null }), /landing/);
});
