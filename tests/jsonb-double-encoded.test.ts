import './helpers/with-phase-flags.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { readJson, readJsonArray, payloadKind } from '../lib/db/jsonb.ts';
import { activeQualityDayProfile, persistQualityDayProfile, profileElements } from '../lib/reclaim/quality-day-store.ts';
import { latestRefinement } from '../lib/reclaim/refinement-store.ts';

// A jsonb COLUMN CAN HOLD A STRING THAT LOOKS LIKE AN OBJECT — and prod holds exactly that.
//
// We bind jsonb params as JSON.stringify(x) with a `$n::jsonb` cast. The cast resolves the PARAMETER's type to
// jsonb, so postgres.js — told the target is jsonb — serialises the value it was handed, and the value it was
// handed is already a JSON string. It is encoded twice and lands as a jsonb SCALAR STRING. PGlite does not do
// this, so every local test and every local walk passed on a shape prod never had.
//
// What broke was not the reads — they all normalise a string on the way out. It was every predicate that reaches
// into the column FROM SQL. `payload->>'kind'` on a jsonb string is NULL, so the filter matched nothing, silently.
// On 2026-08-11 that took a member's Quality Days tracker off their Playbook while the profile and the week both
// sat in the database.
//
// THESE TESTS WRITE THE PROD SHAPE DELIBERATELY. That is the whole point — a fixture in the shape that works
// proves nothing about the shape that doesn't. See [[existence-is-not-the-assertion]].

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('J','j@grintaforlife.test') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

/** Write a coaching_plan payload the way PROD ends up storing it — double-encoded into a jsonb string. */
async function insertDoubleEncoded(db: Db, memberId: string, payload: unknown, status = 'active'): Promise<void> {
  await db.query(
    `insert into coaching_plan (member_id, phase, payload, status) values ($1,'reclaim',$2::jsonb,$3)`,
    [memberId, JSON.stringify(JSON.stringify(payload)), status],
  );
}

test('readJson normalises an object, a JSON string, and a double-encoded string alike', () => {
  const want = { kind: 'quality_day_profile', nonNegotiables: ['bike ride'] };
  assert.deepEqual(readJson(want), want, 'the intended shape');
  assert.deepEqual(readJson(JSON.stringify(want)), want, 'the shape prod stores');
  assert.deepEqual(readJson(JSON.stringify(JSON.stringify(want))), want, 'and one level worse');
});

test('readJson refuses anything that is not an object — a bare string is not a payload', () => {
  assert.equal(readJson('just some text'), null, 'a non-JSON string is not a payload');
  assert.equal(readJson('42'), null, 'a number is not a payload');
  assert.equal(readJson('[1,2]'), null, 'an array is not a payload — readJsonArray is for those');
  assert.equal(readJson(null), null);
  assert.deepEqual(readJsonArray('["a","b"]'), ['a', 'b'], 'arrays have their own reader');
});

test('payloadKind reads the discriminator through either shape', () => {
  assert.equal(payloadKind({ kind: 'c1_refinement' }), 'c1_refinement');
  assert.equal(payloadKind(JSON.stringify({ kind: 'c1_refinement' })), 'c1_refinement');
  assert.equal(payloadKind({ noKind: true }), null, 'absent is null, never a guess');
  assert.equal(payloadKind('not json'), null);
});

test('THE TRACKER BUG: a double-encoded profile is still found', async () => {
  // The exact prod row. Before the fix, `payload->>'kind'` was NULL here, activeQualityDayProfile returned null,
  // c3Rows produced no rows, and weekGrids dropped the week as "nothing to show".
  const { db, memberId } = await freshDb();
  await insertDoubleEncoded(db, memberId, {
    kind: 'quality_day_profile',
    nonNegotiables: ['bike ride', 'Food as fuel not entertainment', 'Connection with family and friends'],
    contributors: ['Making progress on G4L', "Getting a good night's sleep", 'Playing with my dog, Maple'],
    disruptors: ['Arguing with my wife'],
  });
  const p = await activeQualityDayProfile(db, memberId);
  assert.ok(p, 'the profile is found through the double-encoded shape');
  assert.deepEqual(profileElements(p!).slice(0, 2), ['bike ride', 'Food as fuel not entertainment']);
  assert.deepEqual(p!.disruptors, ['Arguing with my wife']);
});

test('a double-encoded C1 refinement is still found — the same shape, a different reader', async () => {
  const { db, memberId } = await freshDb();
  await insertDoubleEncoded(db, memberId, {
    kind: 'c1_refinement',
    preRefinement: [{ text: 'Hard training rides', category: 'physical', tier: null }],
    refinement: { items: [{ original: 'Hard training rides', text: 'Hard training rides', tier: 'top' }] },
  });
  const r = await latestRefinement(db, memberId);
  assert.ok(r, 'the refinement history comes back');
  assert.equal(r!.preRefinement[0]?.text, 'Hard training rides');
});

test('A NEIGHBOURING PAYLOAD IS NEVER MISTAKEN FOR A PROFILE', async () => {
  // coaching_plan hosts more than one reclaim shape. Now that kind is matched in JS rather than SQL, the check
  // that it is still matched AT ALL is this one — a reader that stopped discriminating would pass every test
  // above and hand the Quality Days grid a refinement snapshot.
  const { db, memberId } = await freshDb();
  await insertDoubleEncoded(db, memberId, { kind: 'c1_refinement', refinement: { items: [] } });
  assert.equal(await activeQualityDayProfile(db, memberId), null, 'a refinement is not a Quality Day profile');
});

test('the retire still supersedes ONLY prior profiles, through the double-encoded shape', async () => {
  const { db, memberId } = await freshDb();
  await insertDoubleEncoded(db, memberId, { kind: 'c1_refinement', refinement: { items: [] } });
  await insertDoubleEncoded(db, memberId, { kind: 'quality_day_profile', nonNegotiables: ['old'], contributors: [], disruptors: [] });

  await persistQualityDayProfile(db, memberId, { nonNegotiables: ['new'], contributors: [], disruptors: [] });

  const p = await activeQualityDayProfile(db, memberId);
  assert.deepEqual(p?.nonNegotiables, ['new'], 'the newest definition wins, not whichever row the DB returned');
  const { rows } = await db.query<{ status: string; payload: unknown }>(
    'select status, payload from coaching_plan where member_id=$1',
    [memberId],
  );
  const refinement = rows.find((r) => payloadKind(r.payload) === 'c1_refinement');
  assert.equal(refinement?.status, 'active', 'the neighbouring refinement is NOT collaterally retired');
  const profiles = rows.filter((r) => payloadKind(r.payload) === 'quality_day_profile');
  assert.equal(profiles.filter((r) => r.status === 'active').length, 1, 'exactly one profile is active');
});
