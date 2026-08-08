import './helpers/with-phase-flags.ts'; // MUST be first — asset ids differ between the flagged and unflagged programs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { outcomes } from '../lib/dashboard/outcomes.ts';
import { startPracticeWeek } from '../lib/practice/store.ts';
import { closeWeek } from '../lib/practice/close.ts';

// THE THREE OUTCOMES. What is being pinned here is not the arithmetic — it is the HONESTY of the claim. Greg is
// explicit that Cycle 1 builds the skills and does not hand anyone wellness ("you practise free throws, you do
// not practise winning"), so the failure mode worth testing is a card that says a member HAS something they have
// only started, or that quietly turns three named things into a score.

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('O','o@grintaforlife.test') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}
const close = (db: Db, m: string, id: string) =>
  db.query(`insert into session_progress (member_id, session_id, status, closed_at) values ($1,$2,'closed',now())`, [m, id]);

test('a brand-new member gets three cards, all unbuilt, and no false claim', async () => {
  const { db, memberId } = await freshDb();
  const o = await outcomes(db, memberId);
  assert.equal(o.length, 3);
  assert.deepEqual(o.map((x) => x.product), ['Mindfulness', 'Fitness', 'Wellness']);
  assert.ok(o.every((x) => !x.built), 'nothing is built on day one');
  assert.ok(o.every((x) => x.parts.every((p) => !p.done)));
});

test('the same three Levels in every phase — know, hold, practise', async () => {
  // Greg asked for "a parallel structure for the Level 1, 2 and 3 activities in W, B and C". This is that,
  // asserted, so a later edit cannot quietly give one phase a different shape.
  const { db, memberId } = await freshDb();
  for (const o of await outcomes(db, memberId)) {
    assert.deepEqual(o.parts.map((p) => p.sub), ['what you know', 'what you hold', 'what you practise'], o.product);
  }
});

test('an OPEN practice week is not "built" — it is in progress', async () => {
  const { db, memberId } = await freshDb();
  await close(db, memberId, 'RWR-W1');
  await close(db, memberId, 'RWR-W2');
  await startPracticeWeek(db, memberId, 'w3_logging'); // started, never closed
  const rewire = (await outcomes(db, memberId)).find((o) => o.phase === 'rewire')!;
  const week = rewire.parts[2]!;
  assert.equal(week.done, false, 'a week you are still in is not a thing you hold');
  assert.match(week.running ?? '', /^day \d of 7$/);
  assert.equal(rewire.built, false, 'two of three is not built');
});

test('an outcome is BUILT only when the read, the tool AND the closed week are all there', async () => {
  const { db, memberId } = await freshDb();
  await close(db, memberId, 'RWR-W1');
  await close(db, memberId, 'RWR-W2');
  await startPracticeWeek(db, memberId, 'w3_logging');
  await closeWeek(db, memberId, 'w3_logging');
  const rewire = (await outcomes(db, memberId)).find((o) => o.phase === 'rewire')!;
  assert.ok(rewire.built);
  assert.ok(rewire.parts.every((p) => p.done));
  assert.equal(rewire.parts[2]!.running, undefined, 'a closed week stops advertising a day count');
});

test('phases are independent — finishing Rewire claims nothing about Rebuild', async () => {
  const { db, memberId } = await freshDb();
  await close(db, memberId, 'RWR-W1');
  await close(db, memberId, 'RWR-W2');
  await startPracticeWeek(db, memberId, 'w3_logging');
  await closeWeek(db, memberId, 'w3_logging');
  const o = await outcomes(db, memberId);
  assert.equal(o.find((x) => x.phase === 'rewire')!.built, true);
  assert.equal(o.find((x) => x.phase === 'rebuild')!.built, false);
  assert.equal(o.find((x) => x.phase === 'reclaim')!.built, false);
});

test('wellness is marked as the one the other two feed — and only wellness', async () => {
  const { db, memberId } = await freshDb();
  const o = await outcomes(db, memberId);
  assert.equal(o.find((x) => x.phase === 'reclaim')!.fedByOthers, true);
  assert.equal(o.find((x) => x.phase === 'rewire')!.fedByOthers, undefined);
  assert.equal(o.find((x) => x.phase === 'rebuild')!.fedByOthers, undefined);
});

test('NOTHING here is a score, and no copy claims possession', async () => {
  // The two ways this feature could betray its own posture: turn into a number, or tell a member they ARE
  // something. Both are asserted against, because both are one careless edit away.
  const { db, memberId } = await freshDb();
  const o = await outcomes(db, memberId);
  const text = JSON.stringify(o).toLowerCase();
  assert.doesNotMatch(text, /\d\s*(\/|of)\s*3|percent|%|score|rank|level \d/, 'three named things, never a tally');
  assert.doesNotMatch(text, /you are (now )?(mindful|fit|well)\b|you have achieved|congratulations/, 'no possession claim');
  for (const x of o) assert.ok(x.blurb.length > 0 && !/score|grade/i.test(x.blurb));
});
