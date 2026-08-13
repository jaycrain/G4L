import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { proposeEntry, addOwnEntry, listPlaybook } from '../lib/playbook/store.ts';
import { tabFor } from '../lib/playbook/tabs.ts';

// KEEPER TYPE HAS TO REACH THE DATABASE.
//
// It didn't. `proposeEntry` and `addOwnEntry` simply had no keeper_type column in their INSERT, so every line
// written through them landed untyped — and untyped is not neutral. It falls through to the "Who you are"
// chapter, which on prod (Jay's onboarding, 2026-08-11) filed a race goal and a what-lights-you-up line as
// identity statements. Nothing errored; the Playbook just quietly mis-shelved his own words.
//
// A pglite round-trip on purpose: the bug was a missing COLUMN, which no amount of in-memory assertion can see.

async function db(): Promise<Db> {
  const p = new PGlite();
  await applySchema(p as unknown as Db);
  return p as unknown as Db;
}
const M = '11111111-1111-1111-1111-111111111111';
async function member(d: Db) {
  await d.query(`insert into member_profile (member_id, display_name, email) values ($1,'T','t@x.test')`, [M]);
}

test('proposeEntry PERSISTS the keeper type, and it survives the read back', async () => {
  const d = await db(); await member(d);
  await proposeEntry(d, M, { section: 'own_words', body: 'what still moves me', keeperType: 'lights_you_up', keep: true });
  const [e] = await listPlaybook(d, M);
  assert.equal(e!.keeperType, 'lights_you_up', 'the type reached the column, not just the argument');
  assert.equal(tabFor(e!), 'who');
});

test('addOwnEntry persists it too', async () => {
  const d = await db(); await member(d);
  await addOwnEntry(d, M, 'the move that gets me back', 'what_works', undefined, 'recovery_move');
  const [e] = await listPlaybook(d, M);
  assert.equal(e!.keeperType, 'recovery_move');
  assert.equal(tabFor(e!), 'worked', 'and it lands under What worked rather than being shelved as an identity');
});

test('THE REGRESSION, in the exact shape it shipped: a typed line no longer lands in "Who you are"', async () => {
  const d = await db(); await member(d);
  // Before the fix all three of these came back untyped and collapsed into the 'who' chapter together.
  await proposeEntry(d, M, { section: 'own_words', body: 'riding makes me feel like the athlete I am', keeperType: 'lights_you_up', keep: true });
  await proposeEntry(d, M, { section: 'own_words', body: 'I was a competitive cyclist', keeperType: 'definition', keep: true });
  await proposeEntry(d, M, { section: 'what_works', body: 'the training stopped, not the riding', keeperType: 'principle', keep: true });

  // Assert on the TYPE and the resulting chapter — the body prefix is incidental, and slicing it was how the
  // first version of this test failed on its own arithmetic rather than on the behaviour.
  const byBody = new Map((await listPlaybook(d, M)).map((e) => [e.body, e]));
  const expect: [string, string, string][] = [
    ['riding makes me feel like the athlete I am', 'lights_you_up', 'who'],
    ['I was a competitive cyclist', 'definition', 'who'],
    ['the training stopped, not the riding', 'principle', 'worked'],
  ];
  for (const [body, type, tab] of expect) {
    const e = byBody.get(body);
    assert.ok(e, `"${body}" was not stored at all`);
    assert.equal(e!.keeperType, type, `"${body}" should be ${type}`);
    assert.equal(tabFor(e!), tab);
  }
  // The whole point: they no longer share one chapter.
  const chapters = new Set(expect.map(([b]) => tabFor(byBody.get(b)!)));
  assert.equal(chapters.size, 2, 'they land in different places now, instead of all collapsing into "Who you are"');
});

test('an untyped entry is still accepted — legacy rows and unclassifiable lines must not break', async () => {
  const d = await db(); await member(d);
  await proposeEntry(d, M, { section: 'own_words', body: 'no type given', keep: true });
  const [e] = await listPlaybook(d, M);
  assert.equal(e!.keeperType, null, 'null is allowed');
  assert.equal(tabFor(e!), 'who', 'and it falls back to the documented default rather than erroring');
});
