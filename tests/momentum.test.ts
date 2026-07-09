import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { logCall, pulseBeats, netKind, logCallIntent, isCallType, isCallDomain, domainTally } from '../lib/momentum/store.ts';

// Momentum logging (Rewire W3 · Step 3). A call is a discrete event (multiple/day valid); the pulse reads the last
// 14 days → ONE net beat per day (M-5: honest not rosy). Self-monitoring only. Assertions key on the primitive, the
// net-per-day derivation, and the conservative rail intent detector.

test('netKind · a day with any false start is honest, not a clean up-beat (M-5)', () => {
  assert.equal(netKind(true, true), 'false_start', 'false start present → the day reads honest, not rosy');
  assert.equal(netKind(false, true), 'good');
  assert.equal(netKind(false, false), 'quiet');
});

test('logCallIntent · only explicit call labels fire (conservative backstop); false start wins a mixed message', () => {
  assert.equal(logCallIntent('rode this morning, good call'), 'good_call');
  assert.equal(logCallIntent('skipped the walk again, that was a false start'), 'false_start');
  assert.equal(logCallIntent('pretty quiet day today'), 'quiet_day');
  assert.equal(logCallIntent('good call but also a false start earlier'), 'false_start', 'honesty first on a mixed report');
  assert.equal(logCallIntent('I went for a nice ride'), null, 'a passing mention never auto-logs');
  assert.equal(isCallType('good_call'), true);
  assert.equal(isCallType('nope'), false);
});

async function seedMember(db: Db, email: string): Promise<string> {
  return (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Pat', $1) returning member_id`,
      [email],
    )
  ).rows[0]!.member_id;
}

test('logCall + pulseBeats · a logged call moves the pulse; multiple calls/day aggregate to the day net', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-momentum-1@x.com');
  assert.deepEqual(await pulseBeats(db, m), [], 'empty until a call is logged');

  // one good call today → one up-beat
  await logCall(db, m, { type: 'good_call', source: 'rail' });
  assert.deepEqual(await pulseBeats(db, m), [{ kind: 'good' }]);

  // a false start SAME DAY → the day's net becomes honest (false_start), still ONE beat (multiple rows/day valid)
  await logCall(db, m, { type: 'false_start', source: 'momentum_page', note: 'skipped the ride' });
  assert.deepEqual(await pulseBeats(db, m), [{ kind: 'false_start' }], 'M-5: any false start keeps the day honest');
});

test('pulseBeats · a prior good day + today’s slip render as two beats, oldest→newest (recovery reads as the bounce)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-momentum-2@x.com');
  await logCall(db, m, { type: 'good_call', source: 'rail', loggedOn: undefined });
  await db.query(`update momentum_call set logged_on = current_date - 2 where member_id = $1`, [m]); // age it back
  await logCall(db, m, { type: 'false_start', source: 'rail' }); // today
  const beats = await pulseBeats(db, m);
  assert.deepEqual(beats, [{ kind: 'good' }, { kind: 'false_start' }], 'oldest→newest');
});

test('pulseBeats · calls older than the 14-day window fall off', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-momentum-3@x.com');
  await logCall(db, m, { type: 'good_call', source: 'rail' });
  await db.query(`update momentum_call set logged_on = current_date - 20 where member_id = $1`, [m]);
  assert.deepEqual(await pulseBeats(db, m), [], 'a 20-day-old call is outside the rolling 14-day window');
});
test('isCallDomain · only activity/diet are valid domains (Decision OO)', () => {
  assert.equal(isCallDomain('activity'), true);
  assert.equal(isCallDomain('diet'), true);
  assert.equal(isCallDomain('movement'), false);
  assert.equal(isCallDomain(undefined), false);
});

test('logCall + domainTally · per-domain good/false counts; quiet + untagged calls ignored', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-momentum-domain@x.com');
  await logCall(db, m, { type: 'good_call', domain: 'activity', source: 'momentum_page' });
  await logCall(db, m, { type: 'good_call', domain: 'activity', source: 'rail' });
  await logCall(db, m, { type: 'false_start', domain: 'activity', source: 'rail' });
  await logCall(db, m, { type: 'false_start', domain: 'diet', source: 'momentum_page' });
  await logCall(db, m, { type: 'good_call', source: 'rail' }); // untagged → ignored by the tally
  await logCall(db, m, { type: 'quiet_day', domain: 'diet', source: 'rail' }); // quiet → not good/false, ignored

  const t = await domainTally(db, m);
  assert.deepEqual(t.activity, { good: 2, false: 1 }, 'movement: two good, one false');
  assert.deepEqual(t.diet, { good: 0, false: 1 }, 'eating: one false, no good');
});

test('domainTally · a tagged call outside the 14-day window falls off', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-momentum-domain-window@x.com');
  await logCall(db, m, { type: 'good_call', domain: 'activity', source: 'rail' });
  await db.query(`update momentum_call set logged_on = current_date - 20 where member_id = $1`, [m]);
  assert.deepEqual((await domainTally(db, m)).activity, { good: 0, false: 0 }, 'a 20-day-old tag is outside the window');
});
