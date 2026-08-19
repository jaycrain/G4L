// The BOARD's write path — what a member tapping a card is allowed to do that the model is not.
//
// The load-bearing pair is the first two tests. They assert opposite things about the same act, and that asymmetry
// IS the design: a member claiming a Door creates it; the model rating one cannot. If someone ever "tidies" these
// into one code path, the second test is what should stop them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { noteDoorProfile, doorProfile } from '../lib/reconnect/door-profile.ts';
import {
  claimDoorsFromBoard,
  setBiggestImpact,
  setQuietDriftClaim,
  quietDriftClaim,
} from '../lib/reconnect/doors-board-claim.ts';

async function member(db: Db, doors: string[]): Promise<string> {
  const id = (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email, named_door) values ('Pat', 'board@x.test', $1) returning member_id`,
    [doors[0] ?? null],
  )).rows[0]!.member_id;
  for (let i = 0; i < doors.length; i++) {
    await db.query('insert into member_door (member_id, door_slug, is_primary, sort_order) values ($1,$2,$3,$4)',
      [id, doors[i], i === 0, i]);
  }
  return id;
}

test('MEMBER: marking a Door she does not hold CREATES it — her claim outranks our matcher', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['career_cliff']);

  const written = await claimDoorsFromBoard(db, m, [{ slug: 'vanishing', relevance: 3 }]);
  assert.deepEqual(written, ['vanishing']);

  const profile = await doorProfile(db, m);
  const v = profile.find((d) => d.slug === 'vanishing');
  assert.ok(v, 'she said The Vanishing is hers and it must be hers');
  assert.equal(v!.relevance, 3);
  // ...and it sits after the Doors her story produced, rather than jumping the list.
  assert.equal(profile[0]!.slug, 'career_cliff');
});

test('MODEL: rating a Door she does not hold is still a NO-OP — the guard is unchanged', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['career_cliff']);

  // The same act, through the model's path. It rates whatever it heard, and an insert here would let a misread
  // become a fact about her life.
  const touched = await noteDoorProfile(db, m, [{ slug: 'vanishing', relevance: 3 }]);
  assert.equal(touched, 0, 'the model must never be able to add a Door by rating it');
  assert.equal((await doorProfile(db, m)).length, 1);
});

test('marking without rating is allowed — marking and rating are separate acts', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, []);
  await claimDoorsFromBoard(db, m, [{ slug: 'body' }]);
  const [d] = await doorProfile(db, m);
  assert.equal(d!.slug, 'body');
  assert.equal(d!.relevance, null, 'unrated must stay null — never rendered as 0');
});

test('re-claiming an existing Door updates it rather than duplicating', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['body']);
  await claimDoorsFromBoard(db, m, [{ slug: 'body', relevance: 2 }]);
  const profile = await doorProfile(db, m);
  assert.equal(profile.length, 1, 'the upsert must not create a second row');
  assert.equal(profile[0]!.relevance, 2);
});

test('RULING 8: biggest-impact updates primary, and there is exactly ONE', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['career_cliff', 'load_bearer']);

  assert.equal(await setBiggestImpact(db, m, 'load_bearer'), true);

  const rows = (await db.query<{ door_slug: string; is_primary: boolean; biggest_impact: boolean }>(
    'select door_slug, is_primary, biggest_impact from member_door where member_id = $1', [m])).rows;
  assert.equal(rows.filter((r) => r.is_primary).length, 1, 'exactly one primary, always');
  assert.equal(rows.find((r) => r.is_primary)!.door_slug, 'load_bearer');
  assert.equal(rows.filter((r) => r.biggest_impact).length, 1);

  // named_door is the OTHER copy of "which Door is hers" and the dashboard reads it. Leaving it stale is the
  // exact collision ruling #8 exists to close.
  const named = (await db.query<{ named_door: string }>(
    'select named_door from member_profile where member_id = $1', [m])).rows[0]!.named_door;
  assert.equal(named, 'load_bearer', 'named_door must not disagree with the Door she just chose');
});

test('biggest-impact on a Door she does not hold fails LOUDLY rather than inserting', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['body']);
  assert.equal(await setBiggestImpact(db, m, 'marriage'), false);
  assert.equal((await doorProfile(db, m)).length, 1, 'weighing must never be how a Door gets added');
});

test('the quiet-drift claim is NOT a Door, and null means never asked', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['body']);

  assert.equal(await quietDriftClaim(db, m), null, 'absent must never render as "no"');

  await setQuietDriftClaim(db, m, true);
  const first = await quietDriftClaim(db, m);
  assert.ok(first instanceof Date);
  assert.equal((await doorProfile(db, m)).length, 1, 'claiming quiet drift must not create a Door');

  // Idempotent — the timestamp records when she FIRST said it; re-tapping does not rewrite her history.
  await setQuietDriftClaim(db, m, true);
  assert.equal((await quietDriftClaim(db, m))!.getTime(), first!.getTime());

  // Un-marking is a statement too.
  await setQuietDriftClaim(db, m, false);
  assert.equal(await quietDriftClaim(db, m), null);
});

// THE WIRE FORMAT — round-trip, not halves.
//
// The board is a client component and the engine is server-side, so her selection crosses as a string. Testing a
// serializer that passes and a parser that passes proves nothing about the pair; the failure mode is that they
// drift and the member's taps silently reach nothing.

test('the board submission round-trips exactly', async () => {
  const { serializeBoardSubmission, parseBoardSubmission } = await import('../lib/reconnect/doors-board-claim.ts');
  const sel = {
    doors: [
      { slug: 'body' as const, relevance: 3 },
      { slug: 'loss' as const, relevance: null },
      { slug: 'vanishing' as const, relevance: 1 },
    ],
    quietDrift: true,
    first: 'loss' as const,
    biggest: 'body' as const,
    stillOpen: ['vanishing' as const],
  };
  assert.deepEqual(parseBoardSubmission(serializeBoardSubmission(sel)), sel);
});

test('an ordinary member message is NOT a board submission', async () => {
  const { parseBoardSubmission } = await import('../lib/reconnect/doors-board-claim.ts');
  // She must be able to type anything without the engine treating it as taps.
  assert.equal(parseBoardSubmission('I think the body one is me, honestly'), null);
  assert.equal(parseBoardSubmission(''), null);
});

test('a temporal answer about an UNMARKED Door is dropped', async () => {
  const { parseBoardSubmission } = await import('../lib/reconnect/doors-board-claim.ts');
  // The component clears these when she unmarks, but the engine must not trust a client to have done that.
  const p = parseBoardSubmission('[board] door:body biggest:marriage open:grind first:body')!;
  assert.equal(p.biggest, null, 'cannot weigh a Door she did not mark');
  assert.deepEqual(p.stillOpen, []);
  assert.equal(p.first, 'body', 'but a marked one stands');
});

test('an unknown slug is dropped, never guessed at', async () => {
  const { parseBoardSubmission } = await import('../lib/reconnect/doors-board-claim.ts');
  const p = parseBoardSubmission('[board] door:body door:acceptance door:not_a_door=7')!;
  assert.deepEqual(p.doors.map((d) => d.slug), ['body'], 'the retired slug must not resurrect through the wire');
});

test('an empty board is a valid answer — she is never blocked (ruling 7)', async () => {
  const { parseBoardSubmission, boardIsEmpty, serializeBoardSubmission } = await import('../lib/reconnect/doors-board-claim.ts');
  const empty = { doors: [], quietDrift: false, first: null, biggest: null, stillOpen: [] };
  const p = parseBoardSubmission(serializeBoardSubmission(empty))!;
  assert.ok(p, 'an empty submission is still a submission, not an ordinary message');
  assert.equal(boardIsEmpty(p), true);
  assert.equal(boardIsEmpty(parseBoardSubmission('[board] quiet_drift')!), false, 'quiet drift alone is an answer');
});

test('an out-of-range rating becomes null, never a clamped guess', async () => {
  const { parseBoardSubmission } = await import('../lib/reconnect/doors-board-claim.ts');
  const p = parseBoardSubmission('[board] door:body=99 door:loss=0')!;
  assert.equal(p.doors.find((d) => d.slug === 'body')!.relevance, null);
  assert.equal(p.doors.find((d) => d.slug === 'loss')!.relevance, null);
});

test('a pre-lit Door submits with NO rating — recognition is not a judgement she made', async () => {
  const { parseBoardSubmission } = await import('../lib/reconnect/doors-board-claim.ts');
  // The board pre-lights the Doors her story produced, because they ARE hers. Seeding them with a value would
  // submit "very relevant" as something she said, and she never said it.
  const p = parseBoardSubmission('[board] door:aging_parents door:career_cliff')!;
  assert.deepEqual(p.doors, [
    { slug: 'aging_parents', relevance: null },
    { slug: 'career_cliff', relevance: null },
  ]);
});
