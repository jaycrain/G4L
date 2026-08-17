import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { recordB3Entry, b3Entries } from '../lib/rebuild/b3-entry.ts';

// B3's monitoring week — Greg's seven fields. The re-audit found B3 recording a BOOLEAN TICK while his in-app
// summary says the member tracks "Smart Choices, False Starts, obstacles, thoughts, feelings, and how eating and
// movement influence one another". Six of seven had nowhere to go. Mirrors w3-entry.ts, which solved this on 8/8.

async function member(db: Db): Promise<string> {
  return (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Pat', 'b3@x.test') returning member_id`,
  )).rows[0]!.member_id;
}

test('all seven fields round-trip', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  assert.equal(await recordB3Entry(db, m, {
    goodCalls: 'Walked after dinner', falseStarts: 'Skipped the morning one',
    contributed: 'It was already dark by the time I got home', obstacles: 'Late meeting',
    thoughts: 'Felt behind before I started', fuelToMove: 'Ate better on the day I moved',
    reflection: 'Evenings are the fragile part',
  }), true);
  const [e] = await b3Entries(db, m);
  assert.equal(e!.thoughts, 'Felt behind before I started', 'thoughts and feelings survive — the half we were not capturing');
  assert.equal(e!.fuelToMove, 'Ate better on the day I moved');
  assert.equal(e!.contributed, 'It was already dark by the time I got home');
});

test('an empty form is not a logged day', async () => {
  // Writing it would mark the day as recorded without the member having said anything — the grid would then show
  // a day they never wrote.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  assert.equal(await recordB3Entry(db, m, { goodCalls: '   ', reflection: '' }), false);
  assert.equal((await b3Entries(db, m)).length, 0);
});

test('an amendment ADDS without erasing the earlier entry', async () => {
  // A Smart Choice at lunch and a False Start at night must both survive. A naive overwrite drops the morning,
  // silently, and the member sees half their day.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  await recordB3Entry(db, m, { goodCalls: 'Packed a real lunch' });
  await recordB3Entry(db, m, { falseStarts: 'Skipped the walk' });
  const rows = await b3Entries(db, m);
  assert.equal(rows.length, 1, 'one row per day, not two');
  assert.equal(rows[0]!.goodCalls, 'Packed a real lunch', 'the morning entry survived the evening one');
  assert.equal(rows[0]!.falseStarts, 'Skipped the walk');
});

test('fuel-to-move is optional — a day without it is still a logged day', async () => {
  // Greg: "You don't have to find a connection every day." Nothing may require it, and nothing counts how often
  // it is filled.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  assert.equal(await recordB3Entry(db, m, { goodCalls: 'Moved at lunch' }), true);
  assert.equal((await b3Entries(db, m))[0]!.fuelToMove, null);
});
