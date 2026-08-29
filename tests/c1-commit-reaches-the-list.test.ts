// A CONFIRMED PASS REACHES THE MEMBER'S ACTUAL LIST.
//
// This is the test the whole feature was held overnight for. On 2026-08-29 C1's six passes were built, tested and
// deliberately NOT switched on, because a confirmed pass updated `collected.reclaimList` — the conversation's
// copy — and nothing reached the table. That failure does not throw. It tells a member their list was refined and
// loses the change, about the one artifact whose loss leaves no evidence behind.
//
// So the engine tests (c1-six-passes) prove the gate; this one proves the wire. They are different claims and
// only one of them was true yesterday. [[existence-is-not-the-assertion]]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { addReclaimItems, getReclaimItems } from '../lib/beats/store.ts';
import { commitListChange } from '../lib/reclaim/refinement-store.ts';

async function withDb(fn: (db: Db, memberId: string) => Promise<void>): Promise<void> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('C1','c1@example.com') returning member_id`);
  await fn(db, rows[0]!.member_id);
}

const seed = async (db: Db, memberId: string) =>
  addReclaimItems(db, memberId, [
    { text: 'gravel races', category: 'physical' },
    { text: 'ride with friends', category: 'social' },
    { text: 'read again', category: 'self' },
  ]);
const texts = async (db: Db, memberId: string) => (await getReclaimItems(db, memberId)).map((i) => i.text);

test('drop removes it from the live list — softly, so the row and its history survive', async () => {
  await withDb(async (db, memberId) => {
    await seed(db, memberId);
    const r = await commitListChange(db, memberId, { op: 'drop', target: 'read again' });
    assert.equal(r.ok, true, r.reason);
    assert.deepEqual(await texts(db, memberId), ['gravel races', 'ride with friends']);
    // SOFT. removeReclaimItemByText stamps removed_at rather than deleting, so a member who changes their mind
    // has not lost the item's whole trail. Asserted because "it disappeared from the list" is true of both.
    const rows = await db.query<{ n: number }>(
      'select count(*)::int n from reclaim_item where member_id=$1 and removed_at is not null', [memberId]);
    assert.equal(rows.rows[0]!.n, 1, 'the row is still there, stamped');
  });
});

test('reword changes the text and keeps the item', async () => {
  await withDb(async (db, memberId) => {
    await seed(db, memberId);
    const before = await getReclaimItems(db, memberId);
    const id = before.find((i) => i.text === 'gravel races')!.id;
    const r = await commitListChange(db, memberId, { op: 'reword', target: 'gravel races', text: 'ride Big Sugar' });
    assert.equal(r.ok, true, r.reason);
    const after = await getReclaimItems(db, memberId);
    assert.ok(after.some((i) => i.text === 'ride Big Sugar'), 'the new wording is live');
    // SAME ID. A reword that created a new item would silently orphan every tracker, keeper and Move pointing at
    // the old one — the item would look right and its history would be gone.
    assert.equal(after.find((i) => i.text === 'ride Big Sugar')!.id, id, 'it is the same item, reworded');
  });
});

test('add puts a new item on the list, classified like any other', async () => {
  await withDb(async (db, memberId) => {
    await seed(db, memberId);
    const r = await commitListChange(db, memberId, { op: 'add', text: 'coach my daughter’s team' });
    assert.equal(r.ok, true, r.reason);
    const after = await getReclaimItems(db, memberId);
    assert.equal(after.length, 4);
    const added = after.find((i) => i.text === 'coach my daughter’s team')!;
    assert.ok(added.category, 'it arrives categorised, the same as one added from the rail');
  });
});

test('reorder moves them and loses none', async () => {
  await withDb(async (db, memberId) => {
    await seed(db, memberId);
    const r = await commitListChange(db, memberId, { op: 'reorder', order: ['read again', 'gravel races', 'ride with friends'] });
    assert.equal(r.ok, true, r.reason);
    assert.deepEqual(await texts(db, memberId), ['read again', 'gravel races', 'ride with friends']);
  });
});

test('a change that matches nothing FAILS LOUDLY rather than reporting success', async () => {
  // The CAT-36 shape, one layer down. The member has already been told the change was made, so a swallowed
  // failure here is the product lying about their own data. The action logs and leaves it pending to retry.
  await withDb(async (db, memberId) => {
    await seed(db, memberId);
    const r = await commitListChange(db, memberId, { op: 'drop', target: 'something never on the list' });
    assert.equal(r.ok, false, 'it must not report success');
    assert.ok(r.reason, 'and it must say why');
    assert.deepEqual(await texts(db, memberId), ['gravel races', 'ride with friends', 'read again'], 'nothing moved');
  });
});
