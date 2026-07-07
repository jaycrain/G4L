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

test('contextBlock · the SURVEY Grinta Index owns the name + relabels the activity register as the Daily Call', () => {
  const block = contextBlock({
    ...base,
    grintaScore: 62, grintaTrend: 'up', // the activity register (Daily Call)
    grintaIndex: 3.42, grintaStrands: { reconnect: 3.33, rewire: 2.67, rebuild: 4, reclaim: 3.67 },
    grintaIndexTrend: null, grintaIndexChangePct: null, // baseline
  });
  assert.match(block, /Grinta Index \(their grit, on a 1–5 scale/);
  assert.match(block, /3\.42/);
  assert.match(block, /strands Reconnect 3\.33, Rewire 2\.67, Rebuild 4, Reclaim 3\.67/);
  assert.match(block, /baseline — it moves at Checkpoints/, 'no delta shown on the baseline');
  assert.match(block, /Daily Call rhythm.*62/, 'the activity register is relabeled, not double-named "Grinta Index"');
  assert.doesNotMatch(block, /Grinta Index: 62/, 'the activity score never keeps the Index name when the survey exists');
});

test('contextBlock · post-Checkpoint the Grinta Index shows a signed, up-positive delta', () => {
  const block = contextBlock({ ...base, grintaIndex: 3.6, grintaStrands: { reconnect: 3.9 }, grintaIndexTrend: 'up', grintaIndexChangePct: 12.5 });
  assert.match(block, /up \+12\.5% since last Checkpoint/);
});

test('contextBlock · prod v1 (no survey reading) keeps the legacy activity "Grinta Index" — agent unchanged', () => {
  const block = contextBlock({ ...base, grintaScore: 62, grintaTrend: 'up' }); // no grintaIndex
  assert.match(block, /Grinta Index: 62 \(up lately\)/);
  assert.doesNotMatch(block, /Daily Call rhythm/);
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

test('contextBlock surfaces the named selves + completed Sessions (curriculum awareness)', () => {
  const block = contextBlock({
    ...base,
    namedSelves: ['the Elite Cyclist', 'the Entrepreneur'],
    completedSessions: ['Identity Excavation'],
  });
  assert.match(block, /the Elite Cyclist, the Entrepreneur/); // speaks to all selves
  assert.match(block, /speak to all of them/); // the steer
  assert.match(block, /Sessions they've completed: Identity Excavation/);
});

test('contextBlock surfaces a ready next step (so the MA can send them there)', () => {
  const cp = contextBlock({ ...base, nextStep: { title: 'Reconnect', kind: 'checkpoint', openable: true } });
  assert.match(cp, /next step on the path/);
  assert.match(cp, /Reconnect Checkpoint/);
  assert.match(cp, /send them there/);
  // A not-yet-built step is NOT surfaced (don't route them to "coming soon").
  const soon = contextBlock({ ...base, nextStep: { title: 'Body Inventory', kind: 'session', openable: false } });
  assert.doesNotMatch(soon, /next step on the path/);
});

test('proactiveTeaser is signal-driven', () => {
  assert.match(proactiveTeaser({ ...base, idScore: null }), /IDQ/);
  assert.match(proactiveTeaser({ ...base, lastCompletedAsset: 'Fuel Plan' }), /Fuel Plan/);
  assert.match(proactiveTeaser({ ...base, lastCompletedAsset: null, direction: 'up' }), /working/);
  assert.match(proactiveTeaser({ ...base, lastCompletedAsset: null, direction: null }), /on your mind/);
});
