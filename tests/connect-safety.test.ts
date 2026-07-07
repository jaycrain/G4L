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
