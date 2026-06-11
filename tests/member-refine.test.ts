import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { getReclaimItems } from '../lib/beats/store.ts';
import { addReclaimItemForMember, addDoorForMember } from '../lib/member/refine.ts';

async function seedMember(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email, identity_noun, named_door)
       values ('Tom Miller','tom@x.com','Cyclist','body') returning member_id`,
    )
  ).rows[0]!.member_id;
  await db.query(`insert into member_door (member_id, door_slug, is_primary, sort_order) values ($1,'body',true,0)`, [memberId]);
  return { db, memberId };
}

test('addReclaimItemForMember: a specific item is saved, categorized, and appended', async () => {
  const { db, memberId } = await seedMember();
  const r = await addReclaimItemForMember(db, memberId, 'ride before work without dreading it');
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.category, 'physical');
  const items = await getReclaimItems(db, memberId);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.text, 'ride before work without dreading it');

  // a second item appends (sort_order grows; not a reorder)
  const r2 = await addReclaimItemForMember(db, memberId, 'call my brother every week');
  assert.equal(r2.ok, true);
  const after = await getReclaimItems(db, memberId);
  assert.equal(after.length, 2);
  assert.ok(after[1]!.sortOrder > after[0]!.sortOrder);
});

test('addReclaimItemForMember: fog is refused (the Beat engine could never bind it)', async () => {
  const { db, memberId } = await seedMember();
  const r = await addReclaimItemForMember(db, memberId, 'be happier and more confident');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'vague');
  assert.equal((await getReclaimItems(db, memberId)).length, 0);
});

test('addReclaimItemForMember: empty and duplicate are refused', async () => {
  const { db, memberId } = await seedMember();
  assert.equal((await addReclaimItemForMember(db, memberId, '   ')).ok, false);
  await addReclaimItemForMember(db, memberId, 'ride Carter Lake on Saturdays');
  const dup = await addReclaimItemForMember(db, memberId, 'Ride Carter Lake on Saturdays');
  assert.equal(dup.ok, false);
  if (!dup.ok) assert.equal(dup.reason, 'duplicate');
  assert.equal((await getReclaimItems(db, memberId)).length, 1);
});

test('addDoorForMember: maps free text to a canonical Door, additive, no duplicates', async () => {
  const { db, memberId } = await seedMember();
  const r = await addDoorForMember(db, memberId, 'my wife and I were really struggling, the marriage took a hit');
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.added, ['The Marriage']);

  const rows = (await db.query<{ door_slug: string }>('select door_slug from member_door where member_id=$1 order by sort_order', [memberId])).rows;
  assert.deepEqual(rows.map((x) => x.door_slug).sort(), ['body', 'marriage']);

  // adding the same Door again is a no-op ('already')
  const again = await addDoorForMember(db, memberId, 'the marriage strain');
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.reason, 'already');
});

test('addDoorForMember: unmappable text returns nomatch and writes nothing', async () => {
  const { db, memberId } = await seedMember();
  const before = (await db.query<{ n: number }>('select count(*)::int n from member_door where member_id=$1', [memberId])).rows[0]!.n;
  const r = await addDoorForMember(db, memberId, 'asdfghjkl nothing meaningful here');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'nomatch');
  const after = (await db.query<{ n: number }>('select count(*)::int n from member_door where member_id=$1', [memberId])).rows[0]!.n;
  assert.equal(after, before);
});
