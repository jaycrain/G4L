import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { logCall, pulseBeats, logCallIntent, isCallType, isCallDomain, domainTally } from '../lib/momentum/store.ts';

// Momentum logging (Rewire W3 · Step 3). A call is a discrete event (multiple/day valid); the pulse now reads the last
// 14 days CALL-BY-CALL — every call its own beat (Jay + Greg, Jul 2026), superseding the old per-day net. Self-
// monitoring only. Assertions key on the primitive, the call-by-call derivation, and the conservative rail detector.

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

test('logCall + pulseBeats · EVERY call is its own beat — multiple calls in one day all show (call-by-call)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-momentum-1@x.com');
  assert.deepEqual(await pulseBeats(db, m), [], 'empty until a call is logged');

  // one good call today → one up-beat
  await logCall(db, m, { type: 'good_call', source: 'rail' });
  assert.deepEqual(await pulseBeats(db, m), [{ kind: 'good' }]);

  // a false start, then a good call — all SAME DAY → three distinct beats (the good calls are NOT swallowed by the
  // slip). Same-second inserts have no guaranteed order, so assert the composition: three beats, 2 good + 1 false.
  await logCall(db, m, { type: 'false_start', source: 'momentum_page', note: 'skipped the ride' });
  await logCall(db, m, { type: 'good_call', source: 'rail' });
  const beats = await pulseBeats(db, m);
  assert.equal(beats.length, 3, 'three calls → three beats (not one net) — the good calls survive the slip');
  assert.equal(beats.filter((b) => b.kind === 'good').length, 2);
  assert.equal(beats.filter((b) => b.kind === 'false_start').length, 1);
});

test('pulseBeats · calls order oldest→newest across days (a prior good day, then today’s slip then recovery)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-momentum-2@x.com');
  await logCall(db, m, { type: 'good_call', source: 'rail' });
  await db.query(`update momentum_call set logged_on = current_date - 2 where member_id = $1`, [m]); // 2 days ago
  await logCall(db, m, { type: 'false_start', source: 'rail' });
  await db.query(`update momentum_call set logged_on = current_date - 1 where member_id = $1 and type='false_start'`, [m]); // yesterday
  await logCall(db, m, { type: 'good_call', source: 'rail' }); // today, the recovery
  const beats = await pulseBeats(db, m);
  assert.deepEqual(beats, [{ kind: 'good' }, { kind: 'false_start' }, { kind: 'good' }], 'oldest→newest, call by call');
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
