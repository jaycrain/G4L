// The Founders' authoring identity is a member_profile row that must never behave like a member.
//
// It exists only so a seeded Community topic can have a truthful author. The risk is entirely one-directional:
// a row in member_profile IS a member as far as most of this app is concerned, so it could surface in the roster,
// be counted, or be chased for going quiet — a phantom member in the Console that nobody can explain.
//
// active = false is what prevents that, and it is only a guess until something asserts it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { FOUNDERS_EMAIL, foundersAuthorId } from '../lib/connect/founders.ts';
import { getRoster } from '../lib/admin/roster.ts';
import { attentionLists } from '../lib/admin/console.ts';

async function withFounders(): Promise<{ db: Db; realMember: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await db.query(
    `insert into member_profile (display_name, email, active, ai_consent_granted_at)
     values ('The Founders', $1, false, now())`, [FOUNDERS_EMAIL]);
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Pat','pat@x.test') returning member_id`);
  return { db, realMember: r.rows[0]!.member_id };
}

test('the row exists and is resolvable as an author', async () => {
  const { db } = await withFounders();
  assert.ok(await foundersAuthorId(db), 'a seeded topic needs an author_id to point at');
});

test('…and is INVISIBLE to the roster — it is not a member', async () => {
  const { db } = await withFounders();
  const roster = await getRoster(db);
  assert.equal(roster.some((m) => m.email === FOUNDERS_EMAIL), false,
    'the Founders must never appear in the member roster');
});

test('…and is never chased for going quiet', async () => {
  // The worst version of this bug: an account that cannot act, listed as a member who has stopped acting.
  const { db } = await withFounders();
  // attentionLists takes ROSTER ROWS, not a db — and that is the point of this assertion: it can only ever chase
  // someone the roster handed it, so excluding the Founders from the roster excludes them from here too.
  const lists = attentionLists(await getRoster(db), Date.now());
  const everyone = [...lists.stalled, ...lists.quiet] as Array<{ email?: string }>;
  assert.equal(everyone.some((m) => m?.email === FOUNDERS_EMAIL), false,
    'the Founders must not appear in any attention list');
});

test('resolution is by email, so a missing row degrades rather than throws', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  assert.equal(await foundersAuthorId(db), null, 'before the SQL is run, callers get null and fall back');
});

// ── the post path ──────────────────────────────────────────────────────────────────────────────────────────────

import { createPost } from '../lib/connect/write.ts';

test('a Founders post lands with the Founders as its author and its name shown', async () => {
  const { db } = await withFounders();
  const author = (await foundersAuthorId(db))!;
  const res = await createPost(db, author, {
    title: 'What does your slip usually look like?',
    body: 'Everybody slips. The useful part is knowing your own shape of it.',
    showName: true,
  });
  assert.equal(res.ok, true);

  const { rows } = await db.query<{ title: string; show_name: boolean; author_id: string }>(
    `select title, show_name, author_id from connect_post order by created_at desc limit 1`);
  assert.equal(rows[0]!.author_id, author, 'authored by the Founders row, not by an operator');
  assert.equal(rows[0]!.show_name, true, '"The Founders" is meant to be visible — it is not a person');
});

test('the author is resolved server-side, never taken from the caller', async () => {
  // The guard that matters. Reaching the action is not the same as being able to speak as the Founders — same
  // posture as the Founder Agent having no send tool.
  const src = (await import('node:fs')).readFileSync('app/admin/connect-actions.ts', 'utf8');
  const fn = src.slice(src.indexOf('postAsFoundersAction'));
  assert.match(fn, /foundersAuthorId\(db\)/, 'the author must come from the Founders row');
  assert.doesNotMatch(fn.slice(0, fn.indexOf('createPost')), /input\.(author|memberId)/,
    'the author must never come from the caller');
});
