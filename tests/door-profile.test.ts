import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { noteDoorProfile, doorProfile, openDoors, describeDoorProfile, normalizeRelevance } from '../lib/reconnect/door-profile.ts';

// R2's Door PROFILE. We stored a bare SET of slugs; Greg's Science Check asks for relevance on each and the
// temporal pattern (first / biggest / still open). These tests hold the rules that make the write safe: it can
// only ever UPDATE a Door the member already holds, absence never becomes zero, and an empty profile produces no
// sentence for the model to reflect back.

async function member(db: Db, doors: string[]): Promise<string> {
  const id = (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Pat', 'doors@x.test') returning member_id`,
  )).rows[0]!.member_id;
  for (let i = 0; i < doors.length; i++) {
    await db.query('insert into member_door (member_id, door_slug, is_primary, sort_order) values ($1,$2,$3,$4)',
      [id, doors[i], i === 0, i]);
  }
  return id;
}

test('relevance and the temporal pattern round-trip', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['career_cliff', 'aging_parents']);

  assert.equal(await noteDoorProfile(db, m, [
    { slug: 'career_cliff', relevance: 8, openedFirst: true, stillOpen: false },
    { slug: 'aging_parents', relevance: 5, biggestImpact: true, stillOpen: true },
  ]), 2);

  const p = await doorProfile(db, m);
  const career = p.find((d) => d.slug === 'career_cliff')!;
  assert.equal(career.relevance, 8);
  assert.equal(typeof career.relevance, 'number', 'a string here would break every >= comparison downstream');
  assert.equal(career.openedFirst, true);
  assert.equal(career.stillOpen, false, 'false is a real answer and must not read as unasked');

  assert.deepEqual((await openDoors(db, m)).map((d) => d.slug), ['aging_parents'], 'the active Fade');
});

test('a later turn ADDS to the profile instead of blanking it', async () => {
  // A member gives this up a piece at a time — "the career one, maybe an 8" now, "and that one's still open"
  // three turns later. A naive overwrite would drop the 8.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['career_cliff']);

  await noteDoorProfile(db, m, [{ slug: 'career_cliff', relevance: 8 }]);
  await noteDoorProfile(db, m, [{ slug: 'career_cliff', stillOpen: true }]);

  const [d] = await doorProfile(db, m);
  assert.equal(d!.relevance, 8, 'the earlier rating survives the later fact');
  assert.equal(d!.stillOpen, true);
});

test('rating a Door the member does not hold writes NOTHING — it never creates one', async () => {
  // Adding a Door is add_door: it reflects the wording back and is auditable. If a rating could insert, the model
  // could hand a member a life event they never named, as a side effect of a scale.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['career_cliff']);

  assert.equal(await noteDoorProfile(db, m, [{ slug: 'empty_nest', relevance: 9 }]), 0, 'no Doors touched');
  assert.deepEqual((await doorProfile(db, m)).map((d) => d.slug), ['career_cliff'], 'still exactly one Door');
});

test('a soft-removed Door is not ratable', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['career_cliff', 'aging_parents']);
  await db.query(`update member_door set removed_at = now() where member_id=$1 and door_slug='aging_parents'`, [m]);

  assert.equal(await noteDoorProfile(db, m, [{ slug: 'aging_parents', relevance: 9 }]), 0);
  assert.equal((await doorProfile(db, m)).length, 1, 'and it stays out of the profile');
});

test('an out-of-range rating is dropped, not clamped', async () => {
  // Coercing 0 -> 1 would record a member as having said "barely relevant" when they said nothing of the sort.
  assert.equal(normalizeRelevance(0), null);
  assert.equal(normalizeRelevance(11), null);
  assert.equal(normalizeRelevance('8'), null, 'a string is not a rating');
  assert.equal(normalizeRelevance(undefined), null);
  assert.equal(normalizeRelevance(7.6), 8, 'but "about a 7 or 8" lands somewhere real');
});

test('saying nothing about a Door does not stamp it as asked', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['career_cliff']);

  assert.equal(await noteDoorProfile(db, m, [{ slug: 'career_cliff' }]), 0);
  const { rows } = await db.query<{ noted_at: string | null }>('select noted_at from member_door where member_id=$1', [m]);
  assert.equal(rows[0]!.noted_at, null, 'noted_at means we asked — an empty write must not claim we did');
});

test('an unrated Door reads as null, never 0', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['career_cliff', 'aging_parents']);
  await noteDoorProfile(db, m, [{ slug: 'career_cliff', relevance: 6 }]);

  const other = (await doorProfile(db, m)).find((d) => d.slug === 'aging_parents')!;
  assert.equal(other.relevance, null, 'not asked is not "irrelevant"');
  assert.equal(other.stillOpen, null);
});

test('the profile keeps the member\'s own order — it is not a leaderboard', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['career_cliff', 'aging_parents', 'empty_nest']);
  await noteDoorProfile(db, m, [
    { slug: 'career_cliff', relevance: 2 },
    { slug: 'empty_nest', relevance: 10 },
  ]);
  assert.deepEqual((await doorProfile(db, m)).map((d) => d.slug),
    ['career_cliff', 'aging_parents', 'empty_nest'],
    'sorting by rating would rank a member\'s losses and bury every unrated one');
});

test('an empty profile describes as NOTHING, so the model cannot state an absence as a fact', async () => {
  assert.equal(describeDoorProfile([]), null);
  assert.equal(describeDoorProfile([
    { slug: 'career_cliff', displayName: 'The Career Cliff', isPrimary: true, relevance: null, openedFirst: null, biggestImpact: null, stillOpen: null },
  ]), null, 'a Door with no profile yields no line — "no doors are still open" is not a thing we know');

  const line = describeDoorProfile([
    { slug: 'career_cliff', displayName: 'The Career Cliff', isPrimary: true, relevance: 8, openedFirst: true, biggestImpact: null, stillOpen: false },
    { slug: 'aging_parents', displayName: 'The Aging Parents', isPrimary: false, relevance: null, openedFirst: null, biggestImpact: null, stillOpen: true },
  ])!;
  assert.match(line, /opened first: The Career Cliff/);
  assert.match(line, /still open: The Aging Parents/);
  assert.doesNotMatch(line, /The Aging Parents \d/, 'an unrated Door contributes no rating to the line');
});

test('the database refuses a rating outside 1-10 even if a caller bypasses normalize', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await member(db, ['career_cliff']);
  await assert.rejects(
    db.query('update member_door set relevance = 47 where member_id=$1', [m]),
    'the constraint is the backstop — a surface should never have to decide what a 47 means',
  );
});
