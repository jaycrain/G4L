import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { logEvent, getMemberExperience } from '../lib/telemetry/store.ts';
import { markSessionClosed } from '../lib/curriculum/store.ts';

// v3.0 telemetry EMISSION → FA page, end-to-end. The markSessionClosed-emits-once behavior is covered in
// telemetry.test.ts; this proves the SHAPE the FA member detail page's "How they moved through it" block
// reads: a full workspace lifecycle (open + close + checkpoint open + cross) yields sessions[closed] +
// checkpoints[crossed] in getMemberExperience. Pre-fix these emission points didn't exist, so that block sat
// empty even though session_progress showed closed sessions (the inconsistency Jay saw on Donna's page).

test('a v3.0 workspace lifecycle populates the FA page telemetry (was empty pre-fix)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('QA Walk','qa.walk@x.com') returning member_id`,
  );
  const memberId = rows[0]!.member_id;
  // Emit exactly what the fixed code now emits: the workspace page opens the session, markSessionClosed closes it,
  // the workspace page opens the checkpoint, and the phase action crosses it.
  await logEvent(db, memberId, 'session_open', { surface: 'session', ref: 'RWR-W1' }); // workspace page (live open)
  await markSessionClosed(db, memberId, 'RWR-W1'); // phase action → central close signal
  await logEvent(db, memberId, 'checkpoint_open', { surface: 'checkpoint', ref: 'RWR-CHK' }); // workspace page (checkpoint)
  await logEvent(db, memberId, 'checkpoint_cross', { surface: 'checkpoint', ref: 'RWR-CHK', meta: { phase: 'rewire' } }); // phase action gate

  const exp = await getMemberExperience(db, memberId, (id) => id);
  const s = exp.sessions.find((x) => x.sessionId === 'RWR-W1');
  assert.ok(s, '"How they moved through it" now lists the session (no longer empty)');
  assert.equal(s!.closed, true, 'session shows as completed');
  const c = exp.checkpoints.find((x) => x.checkpointId === 'RWR-CHK');
  assert.ok(c, 'the checkpoint arrival is recorded');
  assert.equal(c!.crossed, true, 'checkpoint shows as crossed');
});
