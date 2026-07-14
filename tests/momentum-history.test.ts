import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { logCall, recentCalls } from '../lib/momentum/store.ts';

// The Momentum history — a logged call has a visible, saved home (Jay: "where does this get placed?"). recentCalls
// plays back exactly what the member logged, newest first, with its note + optional domain.

test('recentCalls returns the member log newest-first with note + domain', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = (await db.query<{ member_id: string }>(`insert into member_profile (display_name, email) values ('Pat', 'mlog@x.com') returning member_id`)).rows[0]!.member_id;

  await logCall(db, m, { type: 'good_call', note: 'Great ride to Jamestown', domain: 'activity', source: 'momentum_page' });
  await logCall(db, m, { type: 'false_start', source: 'rail' });
  await logCall(db, m, { type: 'quiet_day', note: 'rest day', source: 'momentum_page' });

  const log = await recentCalls(db, m);
  assert.equal(log.length, 3);
  // newest-first (same logged_on today → created_at desc): quiet_day was last in
  assert.equal(log[0]!.type, 'quiet_day');
  assert.equal(log[0]!.note, 'rest day');
  const good = log.find((c) => c.type === 'good_call')!;
  assert.equal(good.domain, 'activity');
  assert.match(good.note ?? '', /Jamestown/);
  // an isolated member sees nothing
  const other = (await db.query<{ member_id: string }>(`insert into member_profile (display_name, email) values ('Q', 'q-mlog@x.com') returning member_id`)).rows[0]!.member_id;
  assert.equal((await recentCalls(db, other)).length, 0);
});
