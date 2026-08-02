import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { activityFeed, markUnseen, type FeedItem } from '../lib/admin/console.ts';
import { getActivitySeenAt, markActivitySeen, __resetFounderStateCache } from '../lib/founder/state.ts';

// "SINCE YOU LAST LOOKED" — Jay's instant check-in across a MacBook, an iPad and a phone.
//
// The marker is per-ACCOUNT on purpose: per-device would either show him the same events three times or hide
// them after whichever device got there first. What makes this trustworthy is the edge cases, so they're
// pinned here rather than left to the SQL.

const at = (mins: number) => new Date(Date.UTC(2026, 7, 1, 12, 0, 0) - mins * 60_000).toISOString();
const item = (mins: number): FeedItem =>
  ({ initials: 'DC', text: 'Donna closed RCN-EXC', at: at(mins), memberId: 'd1', tone: 'work' });

test('a FIRST look marks everything new — that is true, not a bug', () => {
  const { feed, unseen } = markUnseen([item(10), item(20)], null);
  assert.equal(unseen, 2);
  assert.ok(feed.every((f) => f.unseen));
});

test('an event exactly ON the boundary counts as seen', () => {
  // Otherwise opening the page twice in a row resurrects the same row, and the count stops meaning anything.
  const boundary = at(10);
  const { unseen } = markUnseen([item(10)], boundary);
  assert.equal(unseen, 0);
});

test('only what landed AFTER the marker is new', () => {
  const { feed, unseen } = markUnseen([item(5), item(30)], at(10));
  assert.equal(unseen, 1);
  assert.equal(feed[0]!.unseen, true, 'the 5-minute-old one');
  assert.equal(feed[1]!.unseen, undefined, 'the 30-minute-old one was already seen');
});

test('the marker round-trips per account, and survives being re-stamped', async () => {
  __resetFounderStateCache();
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  assert.equal(await getActivitySeenAt(db), null, 'never looked → null, so everything reads as new');

  await markActivitySeen(db, at(60));
  assert.equal(await getActivitySeenAt(db), at(60));
  await markActivitySeen(db, at(5)); // a later visit from another device
  assert.equal(await getActivitySeenAt(db), at(5), 'one row per operator — the marker MOVES, it does not pile up');
});

test('BEFORE the migration: the marker reads null and stamping no-ops', async () => {
  __resetFounderStateCache();
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await db.query('drop table if exists founder_state');
  await assert.doesNotReject(() => markActivitySeen(db, at(1)));
  assert.equal(await getActivitySeenAt(db), null, 'degrades to "first look", which shows everything — honest');
});

// ── THE FEED NOW CARRIES WHAT JAY ASKED FOR ──────────────────────────────────────────────────────────────

test('new members, Grinta movement and Sessions all reach the feed', async () => {
  // member_event only ever held Sessions/Checkpoints/IDQs/goals. Joins and Grinta readings emit no event at
  // all, so they're read from the tables that already hold them — which also means real HISTORY on day one,
  // rather than only what happens from now on.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Donna Crain','d@x.com') returning member_id`)).rows[0]!.member_id;
  await db.query(`insert into member_event (member_id, kind, ref) values ($1,'session_close','RCN-EXC')`, [id]);
  for (const [seq, composite] of [[0, 3.10], [1, 3.80]] as const) {
    await db.query(
      `insert into grinta_reading (member_id, source, sequence_no, responses, composite, taken_at)
       values ($1,'onboarding',$2,'{}'::jsonb,$3, now())`, [id, seq, composite]);
  }

  const feed = await activityFeed(db, 50);
  const texts = feed.map((f) => f.text);
  assert.ok(texts.some((t) => t.includes('joined')), 'a signup is the most interesting thing a day can hold');
  assert.ok(texts.some((t) => t.includes('closed RCN-EXC')), 'and Sessions still land');
  assert.ok(texts.some((t) => /Grinta up to/.test(t)), 'Grinta reports its DIRECTION, not just that it happened');
  assert.ok(texts.some((t) => /first Grinta reading/.test(t)), 'a baseline has no direction and must not claim one');
});

test('a DOWNWARD Grinta is not toned as a failure', async () => {
  // Movement is information, never a verdict (the Three Feedbacks). Colouring a dip like a loss would put a
  // judgement on the operator surface that the member is deliberately never shown.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = (await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Pat Nolan','p@x.com') returning member_id`)).rows[0]!.member_id;
  for (const [seq, composite] of [[0, 4.20], [1, 3.10]] as const) {
    await db.query(
      `insert into grinta_reading (member_id, source, sequence_no, responses, composite, taken_at)
       values ($1,'checkpoint',$2,'{}'::jsonb,$3, now())`, [id, seq, composite]);
  }
  const down = (await activityFeed(db, 50)).find((f) => /Grinta down/.test(f.text));
  assert.ok(down, 'the dip is reported');
  assert.equal(down!.tone, 'work', 'as movement, not as a loss');
});

test('demo personas stay out of every source', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await db.query(`insert into member_profile (display_name, email) values ('Demo','demo@grintaforlife.test')`);
  assert.deepEqual(await activityFeed(db, 50), [], 'including the join row the union added');
});

test('THE BUG: a re-render must not advance the marker', async () => {
  // The first cut stamped inside the page render, and every console page auto-refreshes every 30 seconds —
  // so the marker chased its own tail. Each tick marked everything seen, the count sat at zero forever, and
  // the console badge never appeared. The feature was invisible; Jay's read of it was "I'm lost on this
  // implementation", which is what an invisible feature feels like from the outside.
  //
  // A RENDER IS NOT AN INTENTION. This pins the property that makes the count trustworthy: only a deliberate
  // act moves the marker, so rendering the page a hundred times changes nothing.
  __resetFounderStateCache();
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await markActivitySeen(db, at(60));

  const feed = [item(5), item(10)]; // two events since the marker
  for (let render = 0; render < 5; render++) {
    const seen = await getActivitySeenAt(db);
    const { unseen } = markUnseen(feed, seen);
    assert.equal(unseen, 2, `render ${render + 1} must still report 2 new — a refresh is not an acknowledgement`);
  }

  // Only the explicit act clears it.
  await markActivitySeen(db, at(0));
  const { unseen } = markUnseen(feed, await getActivitySeenAt(db));
  assert.equal(unseen, 0, 'and after "Mark all seen", they are seen');
});

test('the console theme defaults to DARK and persists the choice', async () => {
  // Dark is the intent (the console should not look like the member app); light is the escape hatch.
  // Read server-side so the first paint is right — a client theme flashes the wrong ground while hydrating,
  // and a flash of white on a surface chosen for being dark is worse than having no option at all.
  __resetFounderStateCache();
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { getConsoleTheme, setConsoleTheme } = await import('../lib/founder/state.ts');

  assert.equal(await getConsoleTheme(db), 'dark', 'dark without anyone choosing it');
  await setConsoleTheme(db, 'light');
  assert.equal(await getConsoleTheme(db), 'light');
  await setConsoleTheme(db, 'dark');
  assert.equal(await getConsoleTheme(db), 'dark', 'and back again');
});

test('BEFORE 0070: the theme reads dark and saving no-ops', async () => {
  // This is what bit me locally: the dev server had booted before 0070 existed, so its founder_state had no
  // `theme` column. The fallback did exactly its job — the console stayed dark and nothing threw — which is
  // right for the production migration window and is also why the toggle silently did nothing until I
  // restarted. Correct behaviour, confusing symptom; worth a test so the shape is documented rather than
  // rediscovered.
  __resetFounderStateCache();
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await db.query('alter table founder_state drop column if exists theme');
  const { getConsoleTheme, setConsoleTheme } = await import('../lib/founder/state.ts');
  await assert.doesNotReject(() => setConsoleTheme(db, 'light'));
  assert.equal(await getConsoleTheme(db), 'dark', 'degrades to the default, never to a broken page');
});
