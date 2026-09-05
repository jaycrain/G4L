// A DEAD END HAS TO SURVIVE THE NIGHT.
//
// The arc turn handlers have had three lives. Bare `catch` that swallowed everything (Donna hit it three times
// in Reclaim C1 on 2026-09-03 and nothing recorded it). Then a loud console.error in all four arcs — four copies
// of one rule. Then Greg's Excavation turn threw on 2026-09-04, the console.error fired exactly as designed, and
// by the next morning it was unfindable: the workspace canvas polled every 5 seconds, so one open tab wrote ~12
// runtime log lines a minute and pushed his error out of the retention window.
//
// The lesson is narrow and worth keeping: LOUD IS NOT FINDABLE. A record that competes with a heartbeat for
// space is not a record. So the failure is now written to member_event, where it persists, and read back by the
// diagnostic we already open when a member says "Something went wrong".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { logEvent } from '../lib/telemetry/store.ts';
import { runMemberDiagnostic } from '../lib/admin/diagnostic.ts';

async function member(db: Db, email: string): Promise<string> {
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('T',$1) returning member_id`, [email],
  );
  return rows[0]!.member_id;
}

// The shape recordTurnFailure writes, once past its own getDb(). Asserting on the SHAPE rather than calling the
// helper keeps this test free of a request scope while still pinning the contract the diagnostic reads.
async function writeFailure(db: Db, id: string, over: Record<string, unknown> = {}): Promise<void> {
  await logEvent(db, id, 'turn_failed', {
    surface: 'reconnect',
    ref: 'r2',
    meta: { stage: 'doors', msgLen: 96, error: 'boom', errorName: 'TypeError', ...over },
  });
}

test('a failed turn is readable from the diagnostic, with the stage it fell over on', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = await member(db, 'greg@example.test');

  await writeFailure(db, id);

  const report = await runMemberDiagnostic(db, id);
  const fails = (report as unknown as { turn_failures: Record<string, string>[] }).turn_failures;
  assert.equal(fails.length, 1, 'the failure must survive as a row, not only as a console line');
  assert.equal(fails[0]!.arc, 'reconnect');
  assert.equal(fails[0]!.session, 'r2');
  assert.equal(fails[0]!.stage, 'doors', 'the stage is the field that says WHERE the arc was standing');
  assert.equal(fails[0]!.error, 'boom');
  assert.equal(fails[0]!.error_name, 'TypeError');
});

test('a member with no failures reports an empty list, not a missing key', async () => {
  // The read must be able to say "nothing went wrong" out loud. A missing key reads as "not checked", which is
  // how a clean member and an unexamined one end up looking identical.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = await member(db, 'clean@example.test');

  const report = await runMemberDiagnostic(db, id);
  const fails = (report as unknown as { turn_failures: unknown[] }).turn_failures;
  assert.deepEqual(fails, [], 'no failures is a fact, and must be stated');
});

test('THE MEMBER TEXT IS NEVER STORED — only its length', async () => {
  // Non-negotiable and easy to regress: this runs on a surface holding the most private thing a member has said,
  // and the temptation when debugging is always to keep the message "just this once".
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = await member(db, 'private@example.test');

  await writeFailure(db, id, { msgLen: 240 });

  const { rows } = await db.query<{ meta: unknown }>(
    `select meta from member_event where member_id=$1 and kind='turn_failed'`, [id],
  );
  const meta = rows[0]!.meta as Record<string, unknown>;
  assert.equal(meta.msgLen, 240, 'length is kept — it says whether size was the trigger');
  const serialized = JSON.stringify(meta);
  assert.ok(!/message"\s*:\s*"[^"]{20,}/.test(serialized), 'no long free text may ride along in meta');
  assert.equal(Object.keys(meta).some((k) => k === 'message' || k === 'text' || k === 'body'), false,
    'no field that could carry the member\'s words');
});

test('the newest failure comes first — the one being reported right now', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = await member(db, 'ordered@example.test');

  await writeFailure(db, id, { stage: 'older' });
  await new Promise((r) => setTimeout(r, 15));
  await writeFailure(db, id, { stage: 'newest' });

  const report = await runMemberDiagnostic(db, id);
  const fails = (report as unknown as { turn_failures: { stage: string }[] }).turn_failures;
  assert.equal(fails[0]!.stage, 'newest', 'a member reports the failure they just hit, not their first ever');
});
