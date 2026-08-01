import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { fileCrisisReport } from '../lib/connect/write.ts';

// CRISIS ROUTING IS ALWAYS ON (AI Governance Framework, hard rule).
//
// Three call sites filed the auto-report with a bare `await`. Their content is already inserted by then, so a
// failing INSERT threw out of the whole action: the post stayed, the flag was never filed, nobody followed up,
// and the member — who had just written something painful — got an error screen.
//
// Two properties matter and they pull in opposite directions, so both are pinned here.

test('a crisis report actually files, with the safety flag set', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await fileCrisisReport(db, 'post', '11111111-1111-1111-1111-111111111111', 'Auto-flagged — please follow up.', 'regex');

  const { rows } = await db.query<{ concern_for_safety: boolean; source: string; status: string }>(
    `select concern_for_safety, source, status from connect_report`,
  );
  assert.equal(rows.length, 1, 'the report must actually exist — this is the whole point');
  assert.equal(rows[0]!.concern_for_safety, true, 'it must jump the queue');
  assert.equal(rows[0]!.source, 'system', 'filed by the system, not attributed to a member');
  assert.equal(rows[0]!.status, 'open', 'and be waiting for a human');
});

test('a FAILED filing never throws — the member still gets their resources', async () => {
  // The 988 hand-off is the urgent half and it happens in the caller. If this threw, the member in distress
  // would see an error page instead of help. Simulated by pointing it at a database with no schema at all.
  const broken = new PGlite() as unknown as Db; // no applySchema — every insert fails
  await assert.doesNotReject(
    () => fileCrisisReport(broken, 'post', '11111111-1111-1111-1111-111111111111', 'reason', 'regex'),
    'filing failure must be contained here, never surfaced to a member mid-crisis',
  );
});
