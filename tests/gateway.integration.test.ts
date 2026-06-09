// End-to-end Gateway flow against a real (ephemeral) Postgres via pglite, using the offline
// scripted provider. Proves onboarding -> IDQ -> dashboard works as a whole: persistence,
// scoring, governance, and dosing. No Next.js, no key, no network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { scriptedProvider } from '../lib/agent/provider.ts';
import { runOnboarding, submitIdq, getDashboard } from '../lib/gateway/flow.ts';
import {
  onboardingNextTurn,
  collectedToFields,
  INITIAL_STATE,
  type ConvMessage,
} from '../lib/agent/onboarding.ts';

async function freshDb(): Promise<Db> {
  const db = new PGlite();
  await applySchema(db as unknown as Db);
  return db as unknown as Db;
}

const validOnboarding = {
  displayName: 'Tom Miller',
  email: 'tom@example.com',
  doors: ['career_cliff', 'body'], // multi-Door
  identityNoun: 'athlete',
  athleticPast: 'competitive cyclist who rode every weekend',
  gap: 'the role ended and the bike gathered dust',
  reclaimList: ['ride again', 'sleep well', 'coach a friend', 'climb', 'reconnect with Dana', 'race Moab', 'feel strong'],
};

test('full Gateway: onboarding -> IDQ -> dashboard', async () => {
  const db = await freshDb();

  const ob = await runOnboarding(db, scriptedProvider, validOnboarding);
  assert.equal(ob.ok, true);
  if (!ob.ok) return;

  // baseline IDQ, all 3s -> 60
  const idq = await submitIdq(db, ob.memberId, Array.from({ length: 24 }, () => 3));
  assert.equal(idq.ok, true);
  if (!idq.ok) return;
  assert.equal(idq.idScore, 60);
  assert.equal(idq.sequenceNo, 0);

  const dash = await getDashboard(db, ob.memberId);
  assert.ok(dash);
  assert.equal(dash!.displayName, 'Tom Miller');
  assert.equal(dash!.identityNoun, 'Athlete'); // natural case, not all-caps
  // Primary Door for single-value reads; full set available too.
  assert.equal(dash!.door?.displayName, 'The Career Cliff');
  assert.deepEqual(dash!.doors.map((d) => d.slug), ['career_cliff', 'body']);
  assert.equal(dash!.doors[0]!.isPrimary, true);
  assert.equal(dash!.reclaimList.length, 7);
  assert.match(dash!.identityParagraph ?? '', /the Athlete/);

  // Score is presented compliantly (number + context), never bare; baseline => no direction.
  assert.equal(dash!.score?.score, 60);
  assert.equal(dash!.score?.direction, null);
  assert.ok((dash!.score?.context ?? '').length > 0);

  // Dosing v1: all dims equal (18) -> lowest resolves to the first dimension, physical.
  assert.equal(dash!.currentFocus?.dimension, 'physical');
});

test('a second IDQ shows upward movement vs baseline', async () => {
  const db = await freshDb();
  const ob = await runOnboarding(db, scriptedProvider, validOnboarding);
  assert.ok(ob.ok);
  if (!ob.ok) return;

  await submitIdq(db, ob.memberId, Array.from({ length: 24 }, () => 3)); // baseline 60
  const second = await submitIdq(db, ob.memberId, Array.from({ length: 24 }, () => 4)); // 80
  assert.ok(second.ok);
  if (!second.ok) return;
  assert.equal(second.idScore, 80);

  const dash = await getDashboard(db, ob.memberId);
  assert.equal(dash!.score?.score, 80);
  assert.equal(dash!.score?.direction, 'up');
  assert.match(dash!.score?.context ?? '', /right direction/i);
});

test('crisis language in intake halts onboarding and routes to 988', async () => {
  const db = await freshDb();
  const res = await runOnboarding(db, scriptedProvider, {
    ...validOnboarding,
    gap: "honestly some days I want to die and don't see the point",
  });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal((res as { crisis?: boolean }).crisis, true);
  assert.match((res as { message: string }).message, /988/);

  // nothing was persisted for a crisis-halted onboarding
  const n = (await db.query<{ n: number }>('select count(*)::int n from member_profile')).rows[0]!.n;
  assert.equal(n, 0);
});

test('re-onboarding the same email returns a friendly error, not a crash', async () => {
  const db = await freshDb();
  const first = await runOnboarding(db, scriptedProvider, validOnboarding);
  assert.equal(first.ok, true);

  const second = await runOnboarding(db, scriptedProvider, validOnboarding);
  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.match((second as { errors: string[] }).errors.join(' '), /already exists/i);

  // a different email still works
  const third = await runOnboarding(db, scriptedProvider, { ...validOnboarding, email: 'tom2@example.com' });
  assert.equal(third.ok, true);
});

test('conversational onboarding drives to completion and persists end-to-end', async () => {
  const db = await freshDb();
  const ctx = { name: 'Reshma Patel', email: 'reshma@example.com' };

  // opening (scripted path, no key in test env)
  const open = await onboardingNextTurn({ ctx, state: INITIAL_STATE, history: [], memberMessage: null });
  assert.match(open.reply, /guided by AI/);
  let state = open.state;
  const history: ConvMessage[] = [{ role: 'agent', text: open.reply }];
  async function say(text: string) {
    const t = await onboardingNextTurn({ ctx, state, history, memberMessage: text });
    history.push({ role: 'member', text }, { role: 'agent', text: t.reply });
    state = t.state;
    return t;
  }

  await say('a marathoner who ran before dawn'); // who they were
  await say('runner'); // name it
  await say('run a 5k, sleep deep, travel, garden, call mom weekly'); // reclaim list (>= 3)
  const last = await say('a diagnosis stopped me cold, and then the empty nest'); // multi-Door
  assert.equal(last.complete, true);

  const res = await runOnboarding(db, scriptedProvider, collectedToFields(ctx, last.state.collected));
  assert.equal(res.ok, true);
  if (!res.ok) return;

  const dash = await getDashboard(db, res.memberId);
  assert.equal(dash?.identityNoun, 'Runner');
  // matchDoors returns canonical order; the first becomes primary.
  assert.deepEqual(dash?.doors.map((d) => d.slug), ['empty_nest', 'diagnosis']);
  assert.equal(dash?.door?.displayName, 'The Empty Nest');
  assert.ok((dash?.reclaimList.length ?? 0) >= 3);
});

test('onboarding rejects a Reclaim List below the minimum', async () => {
  const db = await freshDb();
  const res = await runOnboarding(db, scriptedProvider, {
    ...validOnboarding,
    reclaimList: ['only', 'two'],
  });
  assert.equal(res.ok, false);
});
