import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  createMeasure,
  logReadingByLabel,
  logReadingById,
  listMeasures,
  measuresForAgent,
  findReclaimItemId,
  looksTrackable,
} from '../lib/measure/store.ts';
import { getJourney } from '../lib/beats/store.ts';

async function seed(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Tom Miller','tom@x.com') returning member_id`,
    )
  ).rows[0]!.member_id;
  return { db, memberId };
}

async function addReclaim(db: Db, memberId: string, text: string, category = 'physical'): Promise<string> {
  return (
    await db.query<{ id: string }>(
      `insert into reclaim_item (member_id, text, category) values ($1,$2,$3) returning id`,
      [memberId, text, category],
    )
  ).rows[0].id;
}

test('create a measure, dedupe by label', async () => {
  const { db, memberId } = await seed();
  const a = await createMeasure(db, memberId, { label: 'Weight', unit: 'lbs', direction: 'down', startValue: 213.4, targetValue: 190 });
  assert.equal(a.ok, true);
  const dup = await createMeasure(db, memberId, { label: 'weight' }); // case-insensitive dupe
  assert.equal(dup.ok, false);
  if (!dup.ok) assert.equal(dup.reason, 'duplicate');
  const none = await createMeasure(db, memberId, { label: '   ' });
  assert.equal(none.ok, false);
});

test('log readings; same-day re-log updates (upsert)', async () => {
  const { db, memberId } = await seed();
  await createMeasure(db, memberId, { label: 'Weight', unit: 'lbs', direction: 'down', startValue: 213.4, targetValue: 190 });
  const r1 = await logReadingByLabel(db, memberId, 'weight', 212.0, '2026-06-12');
  assert.equal(r1.ok, true);
  await logReadingByLabel(db, memberId, 'Weight', 211.5, '2026-06-12'); // same day → update
  await logReadingByLabel(db, memberId, 'Weight', 210.8, '2026-06-13');
  const [m] = await listMeasures(db, memberId);
  assert.equal(m.count, 2); // two distinct days
  assert.equal(m.latestValue, 210.8);
  assert.equal(m.readings[0].value, 211.5); // the updated 6/12 value, not 212.0
});

test('view computes progress + atTarget for a down measure', async () => {
  const { db, memberId } = await seed();
  await createMeasure(db, memberId, { label: 'Weight', unit: 'lbs', direction: 'down', startValue: 200, targetValue: 190 });
  await logReadingByLabel(db, memberId, 'Weight', 195, '2026-06-12'); // halfway: 200→190, at 195
  let [m] = await listMeasures(db, memberId);
  assert.equal(m.progressPct, 50);
  assert.equal(m.atTarget, false);
  await logReadingByLabel(db, memberId, 'Weight', 189, '2026-06-20'); // past target
  [m] = await listMeasures(db, memberId);
  assert.equal(m.progressPct, 100); // clamped
  assert.equal(m.atTarget, true);
});

test('view computes progress for an up measure', async () => {
  const { db, memberId } = await seed();
  await createMeasure(db, memberId, { label: 'Weekly miles', unit: 'mi', direction: 'up', startValue: 50, targetValue: 115 });
  await logReadingByLabel(db, memberId, 'Weekly miles', 82.5, '2026-06-12'); // halfway 50→115
  const [m] = await listMeasures(db, memberId);
  assert.equal(m.direction, 'up');
  assert.equal(m.progressPct, 50);
  assert.equal(m.atTarget, false);
});

test('start falls back to first reading when no explicit baseline', async () => {
  const { db, memberId } = await seed();
  await createMeasure(db, memberId, { label: 'Resting HR', unit: 'bpm', direction: 'down', targetValue: 50 });
  await logReadingByLabel(db, memberId, 'Resting HR', 60, '2026-06-10');
  await logReadingByLabel(db, memberId, 'Resting HR', 55, '2026-06-12');
  const [m] = await listMeasures(db, memberId);
  assert.equal(m.startValue, 60); // earliest reading
  assert.equal(m.latestValue, 55);
});

test('log by id (manual dashboard path) + bad value + nomatch', async () => {
  const { db, memberId } = await seed();
  const a = await createMeasure(db, memberId, { label: 'Weight', direction: 'down' });
  assert.equal(a.ok, true);
  if (!a.ok) return;
  const ok = await logReadingById(db, memberId, a.id, 211, '2026-06-12');
  assert.equal(ok.ok, true);
  const bad = await logReadingById(db, memberId, a.id, NaN);
  assert.equal(bad.ok, false);
  const miss = await logReadingByLabel(db, memberId, 'nonexistent', 1);
  assert.equal(miss.ok, false);
  if (!miss.ok) assert.equal(miss.reason, 'nomatch');
});

test('link a measure to a reclaim item; findReclaimItemId matches loosely', async () => {
  const { db, memberId } = await seed();
  const itemId = await addReclaim(db, memberId, 'Weight down to 190 — started at 213.4 on June 12, 2026');
  const resolved = await findReclaimItemId(db, memberId, 'weight'); // short ref
  assert.equal(resolved, itemId);
  const a = await createMeasure(db, memberId, { label: 'Weight', direction: 'down', reclaimItemId: itemId });
  assert.equal(a.ok, true);
  const [m] = await listMeasures(db, memberId);
  assert.equal(m.reclaimItemId, itemId);
});

test('measuresForAgent is compact and reflects state', async () => {
  const { db, memberId } = await seed();
  await createMeasure(db, memberId, { label: 'Weight', unit: 'lbs', direction: 'down', startValue: 213.4, targetValue: 190 });
  await logReadingByLabel(db, memberId, 'Weight', 211.8, '2026-06-12');
  const [a] = await measuresForAgent(db, memberId);
  assert.equal(a.label, 'Weight');
  assert.equal(a.start, 213.4);
  assert.equal(a.latest, 211.8);
  assert.equal(a.target, 190);
  assert.equal(a.atTarget, false);
  assert.equal(a.count, 1);
});

test('looksTrackable detects measurable targets, ignores bare dates and name lists', () => {
  assert.equal(looksTrackable('Weight down to 190'), true);
  assert.equal(looksTrackable('Raise at least $250k and launch a charter cohort for G4L'), true);
  assert.equal(looksTrackable('$10k per month into retirement savings'), true);
  assert.equal(looksTrackable('Two hard rides a week with 115+ miles total'), true);
  assert.equal(looksTrackable('finish in the top 20% of my age group'), true);
  // negatives — dates and people, no measurable target
  assert.equal(looksTrackable('Race-ready for SBT GRVL (June 28) and Big Sugar (Oct 17)'), false);
  assert.equal(looksTrackable('Text family and friends every other day to stay close'), false);
  assert.equal(looksTrackable('Make a list of college friends and riding buddies'), false);
  assert.equal(looksTrackable(''), false);
});

test('Journey tally counts a climbing tracker as moving — including a witnessed life goal', async () => {
  const { db, memberId } = await seed();
  const itemId = await addReclaim(db, memberId, 'Raise $250k and launch a cohort for G4L', 'life');
  await createMeasure(db, memberId, { label: 'Funds raised', unit: '$', direction: 'up', startValue: 0, targetValue: 250000, reclaimItemId: itemId });

  let j = await getJourney(db, memberId);
  assert.equal(j.reclaim.total, 1);
  assert.equal(j.reclaim.moving, 0); // a tracker with no reading hasn't moved
  assert.equal(j.reclaim.notYet, 1);

  await logReadingByLabel(db, memberId, 'Funds raised', 50000, '2026-06-13'); // climbed toward target
  j = await getJourney(db, memberId);
  assert.equal(j.reclaim.moving, 1); // life goal now reads as moving (the false-zero fix)
  assert.equal(j.reclaim.notYet, 0);
  assert.equal(j.reclaim.reclaimed, 0);
});
