import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { searchMembers, findInFlightOnboarding, escapeLike, isSpecificEnough } from '../lib/admin/diagnostic.ts';

// SEC-05 — the diagnostic is a LOOKUP, not a trawl. Three separate holes fed one outcome:
//   * LIKE metacharacters were not escaped, so ?q=%25 matched EVERY member and _ matched any single character
//   * even without wildcards, a 1-2 char term swept most of the corpus a slice at a time
//   * the route then AUTO-RAN the full diagnostic on the first match — so a loose term didn't just list people,
//     it opened one of them (Doors, facets, Playbook, whole cross-phase state)
// On this endpoint a bare "match" is already a real name + email for someone whose MEMBERSHIP is sensitive.

async function seeded(): Promise<Db> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  for (const [name, email] of [
    ['Donna Reeves', 'donna@example.com'],
    ['Greg Adams', 'greg@example.com'],
    ['Jennifer Cole', 'jennifer@example.com'],
    ['Scott Runkel', 'scott@example.com'],
  ]) {
    await db.query(`insert into member_profile (display_name, email) values ($1,$2)`, [name, email]);
  }
  await db.query(
    `insert into onboarding_session (email, token, state, messages) values ($1,'t','{}'::jsonb,'[]'::jsonb)`,
    ['inflight@example.com'],
  );
  return db;
}

test('a LIKE wildcard cannot widen the search — "%" matches literally, not everybody', async () => {
  const db = await seeded();
  assert.deepEqual(await searchMembers(db, '%'), [], 'the corpus must not fall out of a one-character query');
  assert.deepEqual(await searchMembers(db, '%%%'), [], 'nor a longer one — % is now a literal, and matches no email');
  assert.deepEqual(await searchMembers(db, '___'), [], 'underscore is a single-char wildcard in LIKE — also neutralised');
});

test('the same wildcard rule covers IN-FLIGHT onboardings (the most vulnerable rows we hold)', async () => {
  const db = await seeded();
  assert.deepEqual(await findInFlightOnboarding(db, '%'), []);
  assert.deepEqual(await findInFlightOnboarding(db, '%%%'), []);
  const hit = await findInFlightOnboarding(db, 'inflight@example.com');
  assert.equal(hit.length, 1, 'a real lookup still works');
});

test('a term too short to be a lookup returns nothing rather than a slice of the corpus', async () => {
  const db = await seeded();
  assert.equal(isSpecificEnough('e'), false);
  assert.equal(isSpecificEnough('re'), false);
  assert.deepEqual(await searchMembers(db, 'e'), [], '"e" would otherwise sweep nearly every member');
});

test('real lookups are untouched — the operator can still find who they are looking for', async () => {
  const db = await seeded();
  const byName = await searchMembers(db, 'Donna');
  assert.equal(byName.length, 1);
  assert.equal(byName[0]!.email, 'donna@example.com');

  const byEmail = await searchMembers(db, 'greg@example.com');
  assert.equal(byEmail.length, 1);

  const byId = await searchMembers(db, byName[0]!.memberId);
  assert.equal(byId.length, 1, 'a full member_id resolves even though it contains no name text');
  assert.equal(isSpecificEnough(byName[0]!.memberId), true, 'a UUID is specific by definition');
});

test('escapeLike neutralises metacharacters without mangling ordinary text', () => {
  assert.equal(escapeLike('100%'), '100\\%');
  assert.equal(escapeLike('a_b'), 'a\\_b');
  assert.equal(escapeLike('back\\slash'), 'back\\\\slash');
  assert.equal(escapeLike("o'brien@example.com"), "o'brien@example.com", 'normal addresses pass through intact');
});
