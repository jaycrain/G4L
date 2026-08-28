// "After the Legacy Letter appeared, two 'Why It Works' content blocks were re-displayed that had already been
// shown to the member earlier in the program." (Donna, 2026-08-19.)
//
// Reconnect derives which cards are "taught" from the CURRENT STAGE, which answers how far she has got — not what
// she has seen. Those are the same question inside one sitting, where the component watches each card arrive, and
// different questions across a RESUME: she returns at a late stage, the component has no memory of the earlier
// cards, and all three are treated as newly earned and land together at the end of the thread. Which put repeated
// science immediately after the Legacy Letter, the most personal beat in the arc.
//
// Donna walked Reconnect across two sittings. A single-sitting walk cannot reproduce this, which is worth
// remembering the next time something "works on my machine".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { keepSessionScience, keptScienceStages } from '../lib/content/teaching-keep.ts';

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const raw = new PGlite();
  await raw.waitReady;
  const db: Db = { query: (t, p) => (raw as any).query(t, p), exec: (t) => (raw as any).exec(t) };
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('D','d@d.com') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

test('a science read she already acknowledged is reported as seen, by stage', async () => {
  const { db, memberId } = await freshDb();
  assert.deepEqual(await keptScienceStages(db, memberId, 'r2'), [], 'nothing seen before she starts');

  await keepSessionScience(db, memberId, 'r2', 'the Doors · Reconnect', null, 'doors');
  await keepSessionScience(db, memberId, 'r2', 'the IDQ · Reconnect', null, 'drift');

  const seen = (await keptScienceStages(db, memberId, 'r2')).sort();
  assert.deepEqual(seen, ['doors', 'drift'], 'both come back as stages, which is how the chat keys its cards');
  // The third has not been reached, so it must NOT be suppressed — the failure that matters is hiding science she
  // never saw, which is worse than showing one twice.
  assert.equal(seen.includes('ceremony'), false);
});

test('the stages are per CARD, not per session — Reconnect files three separate reads', async () => {
  // Keyed on the session alone these would collide on the idempotency check and only the first would ever file,
  // while the other two silently reported success. That is why the ref carries the stage.
  const { db, memberId } = await freshDb();
  for (const s of ['doors', 'drift', 'ceremony']) {
    await keepSessionScience(db, memberId, 'r2', `x · ${s}`, null, s);
  }
  assert.equal((await keptScienceStages(db, memberId, 'r2')).length, 3, 'three reads, three stages');
});

test('another session\'s science does not leak into Reconnect\'s seen-set', async () => {
  const { db, memberId } = await freshDb();
  await keepSessionScience(db, memberId, 'r2', 'the Doors · Reconnect', null, 'doors');
  await keepSessionScience(db, memberId, 'w1', 'Disinformation Audit · Rewire', null, null);
  assert.deepEqual(await keptScienceStages(db, memberId, 'r2'), ['doors'], 'the LIKE prefix is anchored to the session');
});

test('a read failure SHOWS the card rather than hiding it', async () => {
  // The safe direction is explicit: showing science she has seen is a papercut; swallowing an error and
  // suppressing a card she has NOT seen costs her the science entirely and looks like nothing went wrong.
  const broken: Db = { query: async () => { throw new Error('db down'); }, exec: async () => {} } as never;
  const orig = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await keptScienceStages(broken, 'm1', 'reconnect'), [], 'nothing suppressed on failure');
  } finally {
    console.error = orig;
  }
});
