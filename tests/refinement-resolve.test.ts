import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { resolveRefinement, commitRefinement } from '../lib/reclaim/refinement-store.ts';

// CAT-36 — "Done, your Reclaim List now reflects where you actually are" while NOTHING changed.
//
// The model's `original` string was the join key at COMMIT time. A wording it invented matched no live item,
// zero rows updated, and the member was told their list was updated anyway. The product lying to someone about
// their own data, on the surface that exists to get exactly that right.
//
// Fix (Jay's option b): resolve to real reclaim_item ids when the refinement is PROPOSED, so nothing that can't
// land ever reaches the confirmation.

async function seed(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Donna','d@x.com') returning member_id`)).rows[0]!.member_id;
  for (const [i, t] of ['Swim a mile without stopping', 'Ride to the coast', 'Sleep through the night'].entries()) {
    await db.query(`insert into reclaim_item (member_id, text, sort_order) values ($1,$2,$3)`, [memberId, t, i]);
  }
  return { db, memberId };
}

test('a refinement resolves to real ids before the member is asked to confirm', async () => {
  const { db, memberId } = await seed();
  const { resolved, unmatched } = await resolveRefinement(db, memberId, [
    { original: 'Swim a mile without stopping', text: 'Swim a mile in open water', tier: 'top' },
  ]);
  assert.equal(unmatched.length, 0);
  assert.ok(resolved[0]!.reclaimItemId, 'it must carry the live id forward, not just the model’s wording');
});

test('an item the model INVENTED is caught at propose time, not discovered at commit', async () => {
  const { db, memberId } = await seed();
  const { resolved, unmatched } = await resolveRefinement(db, memberId, [
    { original: 'Swim a mile without stopping', text: 'Swim a mile in open water', tier: 'top' },
    { original: 'Learn to fly a plane', text: 'Get a pilot licence', tier: 'emerging' }, // never on her list
  ]);
  assert.equal(resolved.length, 1, 'the real one survives');
  assert.equal(unmatched.length, 1, 'the invented one is caught HERE — it never reaches the confirmation');
  assert.equal(unmatched[0]!.original, 'Learn to fly a plane');
});

test('two refined lines cannot both claim the same live item', async () => {
  const { db, memberId } = await seed();
  const { resolved, unmatched } = await resolveRefinement(db, memberId, [
    { original: 'Swim a mile without stopping', text: 'Swim in open water', tier: 'top' },
    { original: 'Swim a mile', text: 'Swim regularly', tier: 'important' }, // fuzzy-matches the same row
  ]);
  assert.equal(resolved.length, 1, 'one refined line per live item');
  assert.equal(unmatched.length, 1);
});

test('a resolved refinement actually APPLIES — the id survives to the commit', async () => {
  const { db, memberId } = await seed();
  const { resolved } = await resolveRefinement(db, memberId, [
    { original: 'Swim a mile without stopping', text: 'Swim a mile in open water', tier: 'top' },
  ]);
  const res = await commitRefinement(db, memberId, { items: resolved, top3: ['Swim a mile in open water'] });
  assert.ok(res.applied > 0, 'zero applied is the bug this whole fix exists to prevent');

  const { rows } = await db.query<{ text: string; tier: string }>(
    `select text, tier from reclaim_item where member_id=$1 and text = 'Swim a mile in open water'`, [memberId]);
  assert.equal(rows.length, 1, 'her wording is actually updated in the live list');
  assert.equal(rows[0]!.tier, 'top');
});
