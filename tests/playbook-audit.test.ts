import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';

// CAN WE TELL A MEMBER WHAT HAPPENED TO WHAT THEY KEPT?
//
// Jay, 2026-08-15, relaying a charter member: "they wanted a report on how everything they entered in the
// Playbook was going. And a week to week comparison over time."
//
// We could not have answered that. playbook_entry mutates in place — `update playbook_entry set state=$3,
// updated_at=now()` — so a Move kept on the 3rd and dropped on the 11th left only `dismissed` and a timestamp.
// The arc a member actually lived (kept it, ran it, let it go) was overwritten by its own ending. Three sibling
// tables already had the audit trigger; this one was missed. Migration 0079 adds it.
//
// These tests assert the HISTORY, not the trigger's existence. "The trigger is attached" is a different claim
// from "the transition is recoverable", and only the second one answers the member.

async function member(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    "insert into member_profile (display_name, email) values ('Audit','audit@grintaforlife.test') returning member_id",
  );
  return { db, memberId: rows[0]!.member_id };
}

/** The audit rows for one entry, oldest first — what a report would read. */
async function trail(db: Db, memberId: string) {
  const { rows } = await db.query<{ field: string; old_value: unknown; new_value: unknown }>(
    `select field, old_value, new_value from member_profile_audit
      where member_id=$1 and source='playbook_entry' order by occurred_at, audit_id`,
    [memberId],
  );
  return rows;
}

test('a Move that was kept and then dropped can still be told as a story', async () => {
  const { db, memberId } = await member();
  const { rows } = await db.query<{ id: string }>(
    `insert into playbook_entry (member_id, section, body, authorship, state)
     values ($1,'what_works','Walk before the house wakes','gathered','proposed') returning id`,
    [memberId],
  );
  const id = rows[0]!.id;

  await db.query("update playbook_entry set state='kept', updated_at=now() where id=$1", [id]);
  await db.query("update playbook_entry set state='dismissed', updated_at=now() where id=$1", [id]);

  const t = await trail(db, memberId);
  assert.equal(t[0]?.field, '_created', 'the entry arriving is itself an event');

  // THE POINT: both transitions survive, in order, with their before and after.
  const states = t.filter((r) => r.field === 'state').map((r) => [r.old_value, r.new_value]);
  assert.deepEqual(states, [['proposed', 'kept'], ['kept', 'dismissed']],
    'proposed→kept→dismissed must all be recoverable — the row alone only ever says "dismissed"');
});

test('updated_at churn does not drown the signal', async () => {
  // Every write touches updated_at. Logging it would double every row and bury the field that matters,
  // which is why 0032 excludes it too.
  const { db, memberId } = await member();
  const { rows } = await db.query<{ id: string }>(
    `insert into playbook_entry (member_id, section, body, authorship, state)
     values ($1,'journal','A page of my own','authored','kept') returning id`,
    [memberId],
  );
  await db.query("update playbook_entry set pinned=true, updated_at=now() where id=$1", [rows[0]!.id]);
  const fields = (await trail(db, memberId)).map((r) => r.field);
  assert.ok(fields.includes('pinned'), 'a pin is a real member act and is recorded');
  assert.ok(!fields.includes('updated_at'), 'but the timestamp that changes on every write is not');
});

test('a body edit keeps the words that were replaced', async () => {
  // A member rewording a Move is the "how is this going" story too — and the old wording is THEIR words,
  // which we do not get to quietly discard.
  const { db, memberId } = await member();
  const { rows } = await db.query<{ id: string }>(
    `insert into playbook_entry (member_id, section, body, authorship, state)
     values ($1,'what_works','Ride 3x','gathered','kept') returning id`,
    [memberId],
  );
  await db.query("update playbook_entry set body=$2, updated_at=now() where id=$1", [rows[0]!.id, 'Ride 4x, one long']);
  const edit = (await trail(db, memberId)).find((r) => r.field === 'body');
  assert.equal(edit?.old_value, 'Ride 3x');
  assert.equal(edit?.new_value, 'Ride 4x, one long');
});

test('deleting an entry does not erase that it existed', async () => {
  const { db, memberId } = await member();
  const { rows } = await db.query<{ id: string }>(
    `insert into playbook_entry (member_id, section, body, authorship, state)
     values ($1,'own_words','I miss being the one who shows up','gathered','kept') returning id`,
    [memberId],
  );
  await db.query('delete from playbook_entry where id=$1', [rows[0]!.id]);
  const t = await trail(db, memberId);
  assert.ok(t.some((r) => r.field === '_deleted'), 'the deletion is an event, with the row it removed');
});
