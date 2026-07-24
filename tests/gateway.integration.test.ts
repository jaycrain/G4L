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

test('a released ("No Longer Central") item drops off the active dashboard list but stays on the subpage', async () => {
  // Jay's walk: two items eliminated during the C1 refinement kept showing at the bottom of the dashboard Reclaim List.
  // The refinement never deletes — it re-tiers to no_longer_central — so the dashboard must exclude released items from
  // the ACTIVE surfaces while keeping them retrievable (releasedReclaimItems) for the subpage.
  const db = await freshDb();
  const ob = await runOnboarding(db, scriptedProvider, validOnboarding);
  assert.ok(ob.ok);
  if (!ob.ok) return;

  const before = await getDashboard(db, ob.memberId);
  assert.equal(before!.reclaimList.length, 7, 'all seven active to start');
  assert.equal(before!.releasedReclaimItems.length, 0);

  // Release two items the way the C1 refinement commit does — set the tier, never delete the row.
  await db.query("update reclaim_item set tier='no_longer_central' where member_id=$1 and text = any($2)", [
    ob.memberId,
    ['feel strong', 'climb'],
  ]);

  const after = await getDashboard(db, ob.memberId);
  assert.equal(after!.reclaimList.length, 5, 'the two released items leave the active list');
  assert.ok(!after!.reclaimList.includes('feel strong') && !after!.reclaimList.includes('climb'), 'not among active priorities');
  assert.ok(!after!.reclaimItems.some((i) => i.text === 'feel strong' || i.text === 'climb'), 'not in the panel items either');
  assert.deepEqual(after!.releasedReclaimItems.map((i) => i.text).sort(), ['climb', 'feel strong'], 'kept + retrievable for the subpage');
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
  // The collision carries code='exists' so finalize routes the member to login (recoverable) instead of a dead-end
  // error at the finish line (Jay's walk — "we'll lose prospective members").
  assert.equal((second as { code?: string }).code, 'exists');

  // a different email still works
  const third = await runOnboarding(db, scriptedProvider, { ...validOnboarding, email: 'tom2@example.com' });
  assert.equal(third.ok, true);
});

test('conversational onboarding drives to completion and persists end-to-end', async () => {
  const db = await freshDb();
  const ctx = { name: 'Reshma Patel', email: 'reshma@example.com' };

  // opening (scripted path, no key in test env) — opens on the question; disclosure is on the start page
  const open = await onboardingNextTurn({ ctx, state: INITIAL_STATE, history: [], memberMessage: null });
  // Anchor on the stable opener phrase ("most like yourself") rather than exact word order — the copy evolved
  // from "who were you" to "who you were" (1b), and pinning to the old wording was the stale assertion.
  assert.match(open.reply, /most like yourself/i);
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

test('onboarding completes a sub-3 Reclaim List (Gate-1 floor decision: card carries the shortfall)', async () => {
  // FLOOR (Jay+Greg, Jun 26): >=3 is the soft AIM, not the hard finalize floor. A two-item list now
  // completes — the confirmation card carries the shortfall; post-onboarding/MA editing reaches the aim.
  const db = await freshDb();
  const ok2 = await runOnboarding(db, scriptedProvider, { ...validOnboarding, reclaimList: ['only', 'two'] });
  assert.equal(ok2.ok, true);
  // An EMPTY list is still rejected — at least one real, member-stated want (RECLAIM_LIST_FLOOR = 1).
  const empty = await runOnboarding(db, scriptedProvider, { ...validOnboarding, email: 'empty@example.com', reclaimList: [] });
  assert.equal(empty.ok, false);
});

test('A-01 · a SKIPPED identity commits identity_noun as NULL (never empty string)', async () => {
  // Distinguish "never named" (recovered at Identity Excavation) from a lost capture: a skipped identity must land as
  // NULL, not ''. Downstream reads treat NULL as cleanly absent; '' would masquerade as a (blank) captured value.
  const db = await freshDb();
  const skipped = await runOnboarding(db, scriptedProvider, {
    ...validOnboarding,
    email: 'skipped@example.com',
    identityNoun: '', // named later, at Excavation
    identitySkipped: true,
  });
  assert.equal(skipped.ok, true);
  if (!skipped.ok) return;
  const row = (
    await db.query<{ identity_noun: string | null }>(`select identity_noun from member_profile where member_id=$1`, [skipped.memberId])
  ).rows[0]!;
  assert.equal(row.identity_noun, null, 'skipped identity persists as NULL');

  // Guard the distinction: a NAMED identity stores the noun (natural case), proving the NULL above is meaningful.
  const named = await runOnboarding(db, scriptedProvider, { ...validOnboarding, email: 'named@example.com' });
  assert.equal(named.ok, true);
  if (!named.ok) return;
  const namedRow = (
    await db.query<{ identity_noun: string | null }>(`select identity_noun from member_profile where member_id=$1`, [named.memberId])
  ).rows[0]!;
  assert.equal(namedRow.identity_noun, 'Athlete');
});
