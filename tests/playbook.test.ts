import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  proposeEntry,
  addOwnEntry,
  listPlaybook,
  keepEntry,
  dismissEntry,
  pinEntry,
  editEntry,
  removeEntry,
  playbookForAgent,
} from '../lib/playbook/store.ts';

async function seed(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Tom Miller','tom@x.com') returning member_id`,
    )
  ).rows[0]!.member_id;
  return { db, memberId };
}

test('proposed keepers land as proposed/gathered; de-dupes the same line', async () => {
  const { db, memberId } = await seed();
  const a = await proposeEntry(db, memberId, {
    section: 'what_works',
    body: 'Food is fuel for the Elite Cyclist — not comfort.',
    source: { kind: 'beat', ref: 'RWR-FUEL-01', label: 'Rewire · Food as fuel' },
  });
  assert.equal(a.created, true);
  assert.equal(a.entry.state, 'proposed');
  assert.equal(a.entry.authorship, 'gathered');
  assert.equal(a.entry.source.label, 'Rewire · Food as fuel');

  // same section + body (case-insensitive) → no duplicate
  const again = await proposeEntry(db, memberId, { section: 'what_works', body: 'food is fuel for the elite cyclist — not comfort.' });
  assert.equal(again.created, false);
  assert.equal(again.entry.id, a.entry.id);
});

test('free-add lands kept/authored in the journal and is visible immediately', async () => {
  const { db, memberId } = await seed();
  const note = await addOwnEntry(db, memberId, 'Rode Brainard at dawn. Felt like myself for an hour.');
  assert.equal(note.state, 'kept');
  assert.equal(note.authorship, 'authored');
  assert.equal(note.section, 'journal');
  const list = await listPlaybook(db, memberId);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.body.startsWith('Rode Brainard'), true);
});

test('keep promotes a proposal; dismiss hides it from the list', async () => {
  const { db, memberId } = await seed();
  const p1 = (await proposeEntry(db, memberId, { section: 'own_words', body: "It's a fade from who I know I am." })).entry;
  const p2 = (await proposeEntry(db, memberId, { section: 'own_words', body: 'The return is the story.' })).entry;

  assert.equal(await keepEntry(db, memberId, p1.id), true);
  assert.equal(await dismissEntry(db, memberId, p2.id), true);

  const list = await listPlaybook(db, memberId);
  const ids = list.map((e) => e.id);
  assert.ok(ids.includes(p1.id)); // kept shows
  assert.ok(!ids.includes(p2.id)); // dismissed hidden
  assert.equal(list.find((e) => e.id === p1.id)!.state, 'kept');
});

test('pin floats to the top of its section; edit + remove work', async () => {
  const { db, memberId } = await seed();
  const first = (await proposeEntry(db, memberId, { section: 'what_works', body: 'First.' })).entry;
  const second = (await proposeEntry(db, memberId, { section: 'what_works', body: 'Second.' })).entry;
  await keepEntry(db, memberId, first.id);
  await keepEntry(db, memberId, second.id);

  assert.equal(await pinEntry(db, memberId, second.id, true), true);
  let list = (await listPlaybook(db, memberId)).filter((e) => e.section === 'what_works');
  assert.equal(list[0]!.id, second.id); // pinned floats up

  assert.equal(await editEntry(db, memberId, first.id, 'First, edited.'), true);
  list = await listPlaybook(db, memberId);
  assert.equal(list.find((e) => e.id === first.id)!.body, 'First, edited.');

  assert.equal(await removeEntry(db, memberId, first.id), true);
  list = await listPlaybook(db, memberId);
  assert.ok(!list.map((e) => e.id).includes(first.id));
});

test('member scoping: cannot mutate another member’s entry', async () => {
  const { db, memberId } = await seed();
  const other = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('Other','o@x.com') returning member_id`,
    )
  ).rows[0]!.member_id;
  const mine = (await proposeEntry(db, memberId, { section: 'own_words', body: 'mine' })).entry;
  // a different member trying to keep/remove my entry affects nothing
  assert.equal(await keepEntry(db, other, mine.id), false);
  assert.equal(await removeEntry(db, other, mine.id), false);
  assert.equal((await listPlaybook(db, memberId)).length, 1);
});

test('playbookForAgent returns kept keepers + recent journal, capped', async () => {
  const { db, memberId } = await seed();
  const k = (await proposeEntry(db, memberId, { section: 'what_works', body: 'The seven-minute start.' })).entry;
  await keepEntry(db, memberId, k.id);
  await proposeEntry(db, memberId, { section: 'own_words', body: 'still proposed, should not appear' });
  await addOwnEntry(db, memberId, 'Journal one.');
  await addOwnEntry(db, memberId, 'Journal two.');

  const ctx = await playbookForAgent(db, memberId, { keptMax: 10, journalMax: 1 });
  assert.equal(ctx.keepers.length, 1); // only the kept keeper, not the proposed one
  assert.equal(ctx.keepers[0]!.body, 'The seven-minute start.');
  assert.equal(ctx.recentNotes.length, 1); // journalMax respected
  assert.equal(ctx.recentNotes[0], 'Journal two.'); // most recent first
});
