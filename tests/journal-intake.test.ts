import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { proposeEntry, addOwnEntry, keepEntry, listPlaybook } from '../lib/playbook/store.ts';

// THE JOURNAL AS INTAKE (2026-08-08). Jay: "all the mail is from YOU."
//
// A flagged keeper is a thing the member SAID; the Journal is the timestamped record of things they said. Moving
// the queue there is mostly presentation — except for EXPAND, which is a real new verb with TWO effects, and a
// two-effect action is exactly the kind that silently half-works. These pin both.

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('J','j@grintaforlife.test') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

const propose = (db: Db, m: string, body: string) =>
  proposeEntry(db, m, { section: 'what_works', body, source: { kind: 'session', ref: 'RWR-W1', label: 'Disinformation Audit' } });

test('expanding a line writes an entry AND keeps the line — both, or the feature is half-built', async () => {
  const { db, memberId } = await freshDb();
  const { entry } = await propose(db, memberId, 'The Cyclist didn’t fade — he got set down for everyone else.');

  // What expandEntryAction does, in the same order. (The action itself is a 'use server' export; this pins the
  // store-level contract it depends on, which is where a regression would actually land.)
  await addOwnEntry(db, memberId, 'Reading that back, the "for everyone else" part is the bit I keep skipping.', 'journal', entry.id);
  await keepEntry(db, memberId, entry.id);

  const all = await listPlaybook(db, memberId);
  const original = all.find((e) => e.id === entry.id)!;
  const written = all.find((e) => e.section === 'journal')!;

  assert.equal(original.state, 'kept', 'writing about a line is the strongest signal it matters — it must not stay pending');
  assert.equal(written.authorship, 'authored', 'the expansion is the MEMBER’s writing, not something we gathered');
  assert.equal(written.source.ref, entry.id, 'the entry links back to the line it grew from');
});

test('an expanded entry is a real Journal entry — it survives as one, on its own', async () => {
  // The point of Expand is that the blank page gets a first sentence. If the writing only existed as an
  // annotation on the keeper it would not be a journal at all.
  const { db, memberId } = await freshDb();
  const { entry } = await propose(db, memberId, 'I didn’t feel like myself.');
  await addOwnEntry(db, memberId, 'Been true since March, if I’m counting honestly.', 'journal', entry.id);

  const journal = (await listPlaybook(db, memberId)).filter((e) => e.section === 'journal');
  assert.equal(journal.length, 1);
  assert.match(journal[0]!.body, /since March/);
  assert.equal(journal[0]!.state, 'kept', 'a member’s own writing is never "proposed" — it is theirs on arrival');
});

test('a cold journal entry carries no keeper link — only expansions do', async () => {
  const { db, memberId } = await freshDb();
  await addOwnEntry(db, memberId, 'Wrote this one from nothing.', 'journal');
  const [e] = (await listPlaybook(db, memberId)).filter((x) => x.section === 'journal');
  assert.equal(e!.source.ref, undefined, 'no phantom link — the stream distinguishes seeded from cold');
});

test('deleting a line removes it from everything the member sees', async () => {
  // "Delete" replaced "Not now". It is their data and the word should mean what it says.
  const { db, memberId } = await freshDb();
  const { entry } = await propose(db, memberId, 'A line they would rather not keep.');
  await db.query(`update playbook_entry set state = 'dismissed' where id = $1`, [entry.id]);
  const all = await listPlaybook(db, memberId);
  assert.equal(all.find((e) => e.id === entry.id), undefined);
});
