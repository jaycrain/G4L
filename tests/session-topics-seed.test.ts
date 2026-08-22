import './helpers/with-phase-flags.ts'; // MUST be first — the registry reads the flags at module scope
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { seedSessionTopics, topicPostId } from '../lib/connect/seed-session-topics.ts';
import { SESSION_TOPICS, topicForSession } from '../lib/connect/session-topics.ts';
import { FOUNDERS_EMAIL } from '../lib/connect/founders.ts';

// DOES THE NUDGE LAND ON ANYTHING?
//
// The four Session topics shipped as CONTENT on 2026-08-21 and the nudge started building `?topic=<sessionKey>`.
// Both halves were real and the feature was not: no row was ever written, and the Community page never read the
// param. A member finishing W3 tapped "Look in →" and arrived at the general feed — the exact complaint the work
// existed to fix. It was reported as fixed the next morning.
//
// The lesson these tests encode: content + a link is not a destination. Something has to WRITE the row, and
// something has to READ the key.

async function freshDb(): Promise<Db> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  return db;
}

async function withFounders(db: Db): Promise<void> {
  await db.query(
    `insert into member_profile (display_name, email, active, ai_consent_granted_at)
     select 'The Founders', $1, false, now()
     where not exists (select 1 from member_profile where lower(email) = $1)`,
    [FOUNDERS_EMAIL],
  );
}

test('without the Founders account it reports WHY, and writes nothing', async () => {
  // A fresh environment genuinely has no Founders row (it is created by hand). Silently writing nothing, or
  // throwing, both leave an operator guessing which of two things is missing.
  const db = await freshDb();
  const res = await seedSessionTopics(db);
  assert.equal(res.created, 0);
  assert.match(res.error ?? '', /Founders account does not exist/);
});

test('the four topics are created, authored by the Founders, and shown by name', async () => {
  const db = await freshDb();
  await withFounders(db);

  const res = await seedSessionTopics(db);
  assert.equal(res.created, SESSION_TOPICS.length);

  const { rows } = await db.query<{ title: string; body: string; show_name: boolean; display_name: string }>(
    `select p.title, p.body, p.show_name, m.display_name
       from connect_post p join member_profile m on m.member_id = p.author_id
      order by p.title`,
  );
  assert.equal(rows.length, SESSION_TOPICS.length);
  for (const r of rows) {
    assert.equal(r.display_name, 'The Founders', 'a real member must never be invented as the author');
    assert.equal(r.show_name, true, 'the whole point is that it is signed rather than fabricated');
    assert.ok(r.body.trim().length > 0);
  }
});

test('re-running refreshes rather than duplicating — it is safe to click twice', async () => {
  const db = await freshDb();
  await withFounders(db);
  await seedSessionTopics(db);
  const again = await seedSessionTopics(db);

  assert.equal(again.created, 0);
  assert.equal(again.updated, SESSION_TOPICS.length);
  const { rows } = await db.query<{ n: string }>(`select count(*)::text as n from connect_post`);
  assert.equal(rows[0]!.n, String(SESSION_TOPICS.length), 'a second run must not post a fifth copy');
});

test('SEAM: every seeded topic is reachable by the key the nudge puts in the URL', async () => {
  // THE REGRESSION THAT MATTERS. The nudge builds `?topic=<sessionKey>`; this asserts that key resolves all the
  // way to a row. A wrong or unseeded key fails silently in production — the member simply lands on the feed.
  const db = await freshDb();
  await withFounders(db);
  await seedSessionTopics(db);

  for (const t of SESSION_TOPICS) {
    const resolved = topicForSession(t.sessionKey);
    assert.ok(resolved, `${t.sessionKey} does not resolve to a topic`);
    const id = await topicPostId(db, t.sessionKey, resolved!.title);
    assert.ok(id, `${t.sessionKey} resolves to a topic with no post behind it`);
  }
});

test('an unknown session key degrades to nothing, never to an error', async () => {
  // A member arriving from a Session must not meet an error about a topic. Falling through to the plain feed is
  // the correct failure, and it is what the page renders when this returns null.
  assert.equal(topicForSession('b4'), null);
  assert.equal(topicForSession(''), null);
  assert.equal(topicForSession(undefined), null);
});
