import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  createMeasure,
  logReadingByLabel,
  logReadingById,
  updateMeasure,
  archiveMeasure,
  listMeasures,
  measuresForAgent,
  findReclaimItemId,
  looksTrackable,
  suggestTracker,
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

test('createMeasure strips a leading quantity that leaks into the unit ("35lbs" → "lbs")', async () => {
  // Donna's walk: a tracker rendered "222 35lbs" because the agent's create_measure passed "35 lbs" as the unit.
  const { db, memberId } = await seed();
  await createMeasure(db, memberId, { label: 'Start with losing', unit: '35lbs', direction: 'down', startValue: 222, targetValue: 187 });
  const [m] = await listMeasures(db, memberId);
  assert.equal(m!.unit, 'lbs', 'the leading number is stripped from the unit');
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

test('suggestTracker parses sensible defaults from goal wording', () => {
  const w = suggestTracker('Weight down to 190 — started at 213.4');
  assert.equal(w.label, 'Weight');
  assert.equal(w.unit, 'lbs');
  assert.equal(w.direction, 'down');
  assert.equal(w.target, 190);

  const raise = suggestTracker('Raise at least $250k and launch a charter cohort for G4L');
  assert.equal(raise.unit, '$');
  assert.equal(raise.direction, 'up');
  assert.equal(raise.target, 250000);
  assert.equal(raise.label, 'Funds raised');

  const save = suggestTracker('$10k per month into retirement savings');
  assert.equal(save.target, 10000);
  assert.equal(save.direction, 'up');
  assert.equal(save.label, 'Savings');

  const miles = suggestTracker('Two hard rides a week with 115+ miles total');
  assert.equal(miles.unit, 'mi');
  assert.equal(miles.direction, 'up');
  assert.equal(miles.target, 115);
  assert.equal(miles.accumulation, false); // a weekly rate, not accumulation

  // accumulation goals baseline at 0 so the amount logged reads as progress
  assert.equal(suggestTracker('Raise at least $250k for G4L').accumulation, true);
  assert.equal(suggestTracker('$10k per month into retirement savings').accumulation, true);
  assert.equal(suggestTracker('Weight down to 190').accumulation, false);

  // an absolute goal has no delta; a delta goal has no absolute target
  assert.equal(w.delta, null, 'an absolute "down to 190" goal carries no delta');
});

test('suggestTracker treats "lose/gain N <unit>" as a DELTA level goal, not an absolute target of N', () => {
  // The Donna walk: "Lose 20 lbs." pre-filled target=20 (a 20-lb goal weight). It's a DELTA — target is
  // current − 20, derived once the member enters where they are now. Never an absolute 20.
  const lose = suggestTracker('Lose 20 lbs.');
  assert.equal(lose.delta, 20, 'carries the amount to lose as a delta');
  assert.equal(lose.target, null, 'no absolute target — it depends on the starting value');
  assert.equal(lose.direction, 'down');
  assert.equal(lose.unit, 'lbs');
  assert.equal(lose.accumulation, false, 'a weight delta is a level goal, never a 0→N accumulation');

  const gain = suggestTracker('Gain 10 lbs of muscle');
  assert.equal(gain.delta, 10);
  assert.equal(gain.target, null);
  assert.equal(gain.direction, 'up', 'gain = higher is better');
  assert.equal(gain.accumulation, false);

  // "shed" also reads as a down delta (verb-driven, not just "lose")
  assert.equal(suggestTracker('Shed 15 lbs').direction, 'down');

  // an ABSOLUTE phrasing keeps its explicit target and stays delta-free
  const abs = suggestTracker('Drop to 190 lbs');
  assert.equal(abs.delta, null, '"to 190" is absolute, not a delta');
  assert.equal(abs.target, 190);

  // money goals remain 0→N accumulation, never deltas
  assert.equal(suggestTracker('Raise $250k for G4L').delta, null);

  // Donna's walk: filler words ("about"/"around") between the verb and the number must NOT defeat the delta,
  // and "-ing" verb forms ("losing") must read as down, not default up.
  const about = suggestTracker('Lose about 35 lbs');
  assert.equal(about.delta, 35, '"about" does not break the delta');
  assert.equal(about.direction, 'down');
  const losing = suggestTracker('Start with losing about 35 lbs');
  assert.equal(losing.delta, 35, '"losing about N" reads as a delta');
  assert.equal(losing.direction, 'down', '"losing" is down, not the default up');
  assert.equal(suggestTracker('Losing around 20 pounds').delta, 20);
});

// #79 — the Companion manages the tracker's lifecycle: adjust the target, retire it (kept + restorable).
test('updateMeasure adjusts the target (fuzzy label match); reflected in the view', async () => {
  const { db, memberId } = await seed();
  await createMeasure(db, memberId, { label: 'Weight', unit: 'lbs', direction: 'down', startValue: 222, targetValue: 190 });
  const r = await updateMeasure(db, memberId, 'weight', { targetValue: 175 });
  assert.equal(r.ok, true);
  const [m] = await listMeasures(db, memberId);
  assert.equal(m!.targetValue, 175, 'new target persisted');
  assert.equal((await updateMeasure(db, memberId, 'nope', { targetValue: 1 })).ok, false, 'no match → not ok');
  const noChange = await updateMeasure(db, memberId, 'Weight', {});
  assert.equal(noChange.ok, false);
  if (!noChange.ok) assert.equal(noChange.reason, 'nochange');
});

test('archiveMeasure retires a tracker — off the active list, never a hard delete', async () => {
  const { db, memberId } = await seed();
  await createMeasure(db, memberId, { label: 'Weekly miles', unit: 'mi', direction: 'up', startValue: 40, targetValue: 115 });
  const r = await archiveMeasure(db, memberId, 'miles');
  assert.equal(r.ok, true);
  assert.equal((await listMeasures(db, memberId)).length, 0, 'retired tracker leaves the active list');
  // The row survives (restorable) — archived_at is set, not deleted.
  const { rows } = await db.query<{ n: string }>('select count(*)::text n from measure where member_id=$1 and archived_at is not null', [memberId]);
  assert.equal(rows[0]!.n, '1', 'kept as history, not deleted');
  assert.equal((await archiveMeasure(db, memberId, 'miles')).ok, false, 'already retired → no active match');
});
