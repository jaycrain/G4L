import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// THE SEAM, NOT THE HALVES. recordB3Entry is proven above and the tool is declared in checkin.ts — and both of
// those were true of a pair that was never wired together once before (see the infinite-loop case in
// tests/coach-gate). What actually has to hold is that a member in a B3 week gets offered the tool, that a member
// in a W3 week ALSO keeps theirs, and that the handler exists to receive the call.
test('the B3 week offers record_b3_day, and an open W3 week alongside it does not displace either', async () => {
  const checkin = await import('../lib/agent/checkin.ts');
  const src = await import('node:fs').then((fs) => fs.readFileSync('lib/agent/checkin.ts', 'utf8'));

  assert.match(src, /name: 'record_b3_day'/, 'the tool is declared');
  assert.match(src, /canRecordB3Day \? \[RECORD_B3_DAY_TOOL\]/, 'and gated into the tool list');
  // Both flags are computed from the FULL week set. Reading the singular `practiceWeek` is what made a member
  // running two weeks lose one of the two tools, silently, depending on which week happened to need attention.
  assert.match(src, /hasOpenWeek\(c, 'w3_logging'\)/, 'W3 reads every open week');
  assert.match(src, /hasOpenWeek\(c, 'b3_pilot'\)/, 'and so does B3');

  const handler = await import('node:fs').then((fs) => fs.readFileSync('app/dashboard/checkin-actions.ts', 'utf8'));
  assert.match(handler, /name === 'record_b3_day'/, 'a declared tool with no handler is a dead call');
  assert.match(handler, /recordB3Entry\(/, 'and the handler reaches the store that the tests above prove');
  assert.ok(checkin, 'module loads');
});

test('WHAT THE COMPANION WRITES, THE COMPANION CAN READ — B3 is not write-only', () => {
  // The audit question that found this (Jay, 2026-08-17: "is the Companion aware of all the new functionality?").
  // record_b3_day let the Companion write a member's day and then never see it again — so someone who described
  // Tuesday found it gone by Thursday, from the one thing in the product that promises to remember. Greg's seven
  // fields are also the integrative material B3 exists to produce, and none of it reached the conversation that
  // collected it.
  const src = readFileSync('app/dashboard/checkin-actions.ts', 'utf8');
  assert.match(src, /b3Entries\(db, memberId, 7\)/, 'the week is read into the companion context');
  assert.match(src, /b3Recent:/, 'and handed over');

  const ctx = readFileSync('lib/agent/checkin.ts', 'utf8');
  assert.match(ctx, /c\.b3Recent\?\.length/, 'rendered only when they actually wrote something');
  assert.match(ctx, /never read it back as a log or count the days/, 'and governed — B3 forbids tallies');
});

// GREG'S TWO HABIT STATUSES — the last two fields of his daily worksheet, added 2026-08-23 (migration 0088).
//
// His log opens on them before any free text: "Physical activity habit — Completed / Partial / Missed", and the
// same for diet. 0084 built the six free-text fields and stopped, so B3's week recorded what a member NOTICED and
// never what she DID.
//
// PARTIAL IS WHY A BOOLEAN COULD NOT STAND IN. His tone spec for this phase says to reinforce that "backup
// versions still count" and to avoid "all-or-nothing interpretations". A member who planned twenty minutes and
// walked ten has an honest answer here; on a tick she must claim a day she did not have or record a failure she
// did not have either.
test('the two habit statuses round-trip, and partial is a first-class answer', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);

  assert.equal(await recordB3Entry(db, m, { activityStatus: 'partial', dietStatus: 'completed' }), true);
  const [day] = await b3Entries(db, m);
  assert.equal(day!.activityStatus, 'partial');
  assert.equal(day!.dietStatus, 'completed');
});

test('a status ALONE is a complete day — she said something', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  // "Missed my walk" and nothing else is a real entry. Requiring free text would drop the honest short days.
  assert.equal(await recordB3Entry(db, m, { activityStatus: 'missed' }), true);
  assert.equal((await b3Entries(db, m))[0]!.activityStatus, 'missed');
});

test('NULL means "didn\'t say" — never inferred as a miss', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  await recordB3Entry(db, m, { goodCalls: 'took the stairs' });
  const [day] = await b3Entries(db, m);
  // Defaulting to 'missed' would record a failure the member never reported — the same rule as w3 recovery_used.
  assert.equal(day!.activityStatus, null);
  assert.equal(day!.dietStatus, null);
});

test('an unrecognised status is dropped, not stored', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  // A value we cannot interpret would render on the grid as a state she never chose. Dropped at the store, so the
  // check constraint is a backstop rather than the only defence.
  assert.equal(await recordB3Entry(db, m, { activityStatus: 'sort of' as never, goodCalls: 'walked' }), true);
  assert.equal((await b3Entries(db, m))[0]!.activityStatus, null);
});

test('amending a day cannot blank a status she already gave, but she can correct it', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db);
  await recordB3Entry(db, m, { activityStatus: 'partial' });
  await recordB3Entry(db, m, { goodCalls: 'and I stretched' });          // later amendment, no status
  assert.equal((await b3Entries(db, m))[0]!.activityStatus, 'partial', 'the amendment must not erase it');
  await recordB3Entry(db, m, { activityStatus: 'completed' });           // she corrects it
  assert.equal((await b3Entries(db, m))[0]!.activityStatus, 'completed', 'but a real correction lands');
});
