import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { getFeed } from '../lib/connect/store.ts';

// A crisis-flagged post is NEVER censored (help-not-silence — it stays in the full feed), but it must never be
// FEATURED as the dashboard's "Trending" highlight. getFeed({ excludeFlagged }) is the dashboard-only guard.
async function seed(): Promise<{ db: Db; member: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const member = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email, identity_noun) values ('Author','a@x.test','Runner') returning member_id`,
    )
  ).rows[0]!.member_id;
  // an ordinary post (older activity) + a crisis post (most-recent activity → would otherwise trend)
  await db.query(
    `insert into connect_post (author_id, title, body, status, created_at, last_activity_at)
       values ($1,'A small win','Rode 10 miles today.','visible', now() - interval '2 hours', now() - interval '2 hours')`,
    [member],
  );
  const crisis = (
    await db.query<{ id: string }>(
      `insert into connect_post (author_id, title, body, status, created_at, last_activity_at)
         values ($1, $2, $2, 'visible', now() - interval '1 hour', now() - interval '1 hour') returning id`,
      [member, "I don't know if my life's worth living"],
    )
  ).rows[0]!.id;
  // the crisis screen files a concern-for-safety report (as routeCrisis does)
  await db.query(
    `insert into connect_report (reporter_id, subject_kind, subject_id, reason, concern_for_safety, status)
       values ($1, 'post', $2, 'auto-flagged', true, 'open')`,
    [member, crisis],
  );
  return { db, member };
}

test('connect safety · the full feed KEEPS the crisis post (help-not-silence)', async () => {
  const { db, member } = await seed();
  const feed = await getFeed(db, 50, member); // full feed, no exclusion
  assert.ok(feed.some((p) => /worth living/i.test(p.body)), 'the crisis post is present in the full feed');
});

test('connect safety · the dashboard featured slot NEVER surfaces the crisis post', async () => {
  const { db, member } = await seed();
  const featured = await getFeed(db, 1, member, { excludeFlagged: true }); // the dashboard "Trending" query
  assert.equal(featured.length, 1, 'still features a post…');
  assert.ok(!/worth living/i.test(featured[0]!.body), '…but never the crisis-flagged one');
  assert.match(featured[0]!.body, /Rode 10 miles/, 'the ordinary post is featured instead');
});

// ---------------------------------------------------------------------------
// SEC-10 — crisis routing must read EVERY field the member wrote, on EVERY surface.
//
// It read `body` only. A post whose distress was in the TITLE with an unremarkable body was never flagged, and
// room creation ran no screening at all — despite rooms.ts's own header claiming rooms carry the same posture as
// posts. Governance calls crisis routing always-on; on those two paths it was simply off. This is the one failure
// in this product that cannot be taken back, so these assert the PATHS, not the phrasing of the detector.
// ---------------------------------------------------------------------------
import { createPost } from '../lib/connect/write.ts';
import { createRoom } from '../lib/connect/rooms.ts';

const DISTRESS = "I don't want to be here anymore";

async function member(db: Db, name = 'M'): Promise<string> {
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ($1, $2) returning member_id`,
    [name, `${name}-${Math.random().toString(36).slice(2)}@x.test`],
  );
  return rows[0]!.member_id;
}
async function fresh(): Promise<Db> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  return db;
}
async function safetyReports(db: Db): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from connect_report where concern_for_safety and source = 'system'`,
  );
  return Number(rows[0]?.n ?? 0);
}

test('SEC-10 · distress in a post TITLE is caught, even when the body is unremarkable', async () => {
  const db = await fresh();
  const id = await member(db);
  const res = await createPost(db, id, { title: DISTRESS, body: 'Went for a walk today.', showName: false });
  assert.equal('ok' in res && res.ok, true);
  assert.equal((res as { crisis?: boolean }).crisis, true, 'the member must be shown 988');
  assert.equal(await safetyReports(db), 1, 'and a human must be asked to follow up');
});

test('SEC-10 · a ROOM TITLE is screened — creating a room ran no crisis check at all', async () => {
  const db = await fresh();
  const id = await member(db);
  const res = await createRoom(db, id, `${DISTRESS}, anyone up?`);
  assert.equal('ok' in res && res.ok, true);
  assert.equal((res as { crisis?: boolean }).crisis, true);
  assert.equal(await safetyReports(db), 1, 'filed against the member — someone to check on, not content to moderate');
});

test('SEC-10 · the room still OPENS — reaching out is never censored or blocked', async () => {
  const db = await fresh();
  const id = await member(db);
  const res = await createRoom(db, id, `${DISTRESS}, anyone up?`);
  assert.equal('ok' in res && res.ok, true, 'help-not-silence: we never refuse the member reaching for people');
  const { rows } = await db.query<{ n: number }>('select count(*)::int as n from connect_room');
  assert.equal(Number(rows[0]!.n), 1, 'the room exists');
});

test('SEC-10 · ordinary titles and rooms raise nothing (the screen is not trigger-happy)', async () => {
  const db = await fresh();
  const id = await member(db);
  await createPost(db, id, { title: 'A small win', body: 'Rode 10 miles today.', showName: false });
  await createRoom(db, id, 'Morning walkers — who is in?');
  assert.equal(await safetyReports(db), 0);
});

// ---------------------------------------------------------------------------
// SEC-09 — pseudonymity must FAIL CLOSED. The notification/cheer label fell back to the member's REAL NAME when
// they had no handle yet, and cheering (unlike posting) never created a Connect profile — so a member whose first
// action was a cheer was published to the person they cheered under their real name, having never chosen to be.
// ---------------------------------------------------------------------------
import { toggleCheer } from '../lib/connect/write.ts';
import { getNotifications } from '../lib/connect/store.ts';

test('SEC-09 · cheering BEFORE ever posting never reveals the cheerer’s real name', async () => {
  const db = await fresh();
  const author = await member(db, 'Author');
  const cheerer = await member(db, 'Jennifer Realname');
  const post = (
    await db.query<{ id: string }>(
      `insert into connect_post (author_id, title, body, status) values ($1,'t','b','visible') returning id`,
      [author],
    )
  ).rows[0]!.id;

  await toggleCheer(db, cheerer, 'post', post); // their very first Connect action

  const notes = await getNotifications(db, author);
  assert.equal(notes.length, 1, 'the author is notified');
  assert.notEqual(notes[0]!.actorLabel, 'Jennifer Realname', 'THE BUG: their real name was published');
  assert.match(notes[0]!.actorLabel, /\w/, 'they still get a usable pseudonymous label');
});

test('SEC-09 · a member who CHOSE to reveal still shows their real name (the guard is not a blanket)', async () => {
  const db = await fresh();
  const author = await member(db, 'Author');
  const cheerer = await member(db, 'Open Book');
  const post = (
    await db.query<{ id: string }>(
      `insert into connect_post (author_id, title, body, status) values ($1,'t','b','visible') returning id`,
      [author],
    )
  ).rows[0]!.id;
  await toggleCheer(db, cheerer, 'post', post);
  await db.query(`update connect_profile set reveal_default = true where member_id = $1`, [cheerer]);

  const notes = await getNotifications(db, author);
  assert.equal(notes[0]!.actorLabel, 'Open Book', 'an explicit choice to be seen is still honoured');
});
