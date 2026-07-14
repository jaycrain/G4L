import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { markSessionClosed, setGate, earnedBadgeIds } from '../lib/curriculum/store.ts';
import { reconcileRedesignBadges } from '../lib/curriculum/view.ts';

// Redesign (Decision WW): the 10 event-driven milestone badges earn idempotently from committed state, so no
// arc-completion code is touched. This proves the session-close + gate → badge mapping.

let seq = 0;
async function seedMember(db: Db): Promise<string> {
  seq += 1;
  return (
    await db.query<{ member_id: string }>(`insert into member_profile (display_name, email) values ('Pat', $1) returning member_id`, [`pat${seq}@x.com`])
  ).rows[0]!.member_id;
}

test('fresh member — reconcile earns none of the milestone badges', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db);
  await reconcileRedesignBadges(db, m);
  const earned = new Set(await earnedBadgeIds(db, m));
  for (const b of ['turned-voice', 'found-why', 'widened-world', 'named-yourself', 'wrote-story', 'starting-line']) {
    assert.ok(!earned.has(b), `${b} not earned for a fresh member`);
  }
});

test('closed sessions + gates → the mapped badges earn (idempotently)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db);
  await markSessionClosed(db, m, 'RWR-W1'); // → turned-voice
  await markSessionClosed(db, m, 'RBLD-B1'); // → found-why
  await markSessionClosed(db, m, 'RCL-C2'); // → widened-world
  await setGate(db, m, 'reconnect_checkpoint_passed'); // → named-yourself
  await setGate(db, m, 'reclaim_checkpoint_passed'); // → wrote-story

  await reconcileRedesignBadges(db, m);
  await reconcileRedesignBadges(db, m); // idempotent — a second pass must not duplicate
  const earned = new Set(await earnedBadgeIds(db, m));

  assert.ok(earned.has('turned-voice'));
  assert.ok(earned.has('found-why'));
  assert.ok(earned.has('widened-world'));
  assert.ok(earned.has('named-yourself'));
  assert.ok(earned.has('wrote-story'));
  // a session NOT closed must not earn its badge
  assert.ok(!earned.has('built-picture'), 'RWR-W2 not closed → no built-picture badge');
});
