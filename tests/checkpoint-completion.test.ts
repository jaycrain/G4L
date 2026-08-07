import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { markCheckpointClosed, markSessionClosed, listGates } from '../lib/curriculum/store.ts';
import { getForecast } from '../lib/curriculum/view.ts';
import { deriveSessionTelemetry, deriveCheckpointTelemetry, getMemberEvents } from '../lib/telemetry/store.ts';

// CHECKPOINT COMPLETION — the half of the completion contract that was never written.
//
// Sessions had markSessionClosed: upsert the progress row, emit session_close on the FIRST close only. Checkpoints
// had nothing. Five separate sites each did `setGate` + an unguarded `logEvent`, and none of them recorded the
// completion anywhere the counters read. Greg's walk (2026-08-07) showed both halves of the damage:
//   · four checkpoints crossed, ZERO rows in session_progress → four of thirteen completions invisible to QI
//   · his Reclaim capstone emitted checkpoint_cross TWICE, 35 minutes apart, because re-entry re-crossed it
//
// CLAUDE.md makes started / completed / time-on-asset / drop-off a required contract per asset, and a checkpoint is
// an asset. These tests are written against the DB rather than a mock because the bug was in what got PERSISTED —
// a unit test over the function's arguments would have passed the whole time it was broken.

async function seedMember(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email, identity_noun, named_door)
       values ('Greg Welk','greg@example.test','Athlete','body') returning member_id`,
    )
  ).rows[0]!.member_id;
  return { db, memberId };
}

const crossCount = async (db: Db, memberId: string, ref: string): Promise<number> =>
  Number(
    (
      await db.query<{ n: string }>(
        `select count(*) n from member_event where member_id = $1 and kind = 'checkpoint_cross' and ref = $2`,
        [memberId, ref],
      )
    ).rows[0]!.n,
  );

test('a crossed checkpoint is RECORDED as closed — it used to leave no trace at all', async () => {
  const { db, memberId } = await seedMember();
  await markCheckpointClosed(db, memberId, { assetId: 'RWR-CHK', eventRef: 'RWR-CHK', phase: 'rewire' });

  const { rows } = await db.query<{ status: string; closed_at: string | null }>(
    `select status, closed_at from session_progress where member_id = $1 and session_id = 'RWR-CHK'`,
    [memberId],
  );
  assert.equal(rows.length, 1, 'no progress row — the completion is invisible again');
  assert.equal(rows[0]!.status, 'closed');
  assert.ok(rows[0]!.closed_at, 'closed_at is what time-on-asset is measured against');
  assert.ok((await listGates(db, memberId)).includes('rewire_checkpoint_passed'), 'the gate still advances the member');
});

test("THE CAPSTONE FIRES ONCE — Greg's fired twice, 35 minutes apart", async () => {
  const { db, memberId } = await seedMember();
  const cp = { assetId: 'RCL-C4', eventRef: 'RCL-CHK', phase: 'reclaim' };
  await markCheckpointClosed(db, memberId, cp);
  await markCheckpointClosed(db, memberId, cp); // re-entry: reading the ceremony again
  await markCheckpointClosed(db, memberId, cp);

  assert.equal(await crossCount(db, memberId, 'RCL-CHK'), 1, 'crossing a gateway is a once-per-cycle event');
  const { rows } = await db.query(`select 1 from session_progress where member_id = $1 and session_id = 'RCL-C4'`, [memberId]);
  assert.equal(rows.length, 1, 'and re-entry must not duplicate the progress row either');
});

test('the two ids are kept apart on purpose (asset id ≠ event ref for Rebuild and Reclaim)', async () => {
  // The progress row must use the CURRICULUM id or getForecast's `closed.has(a.id)` never sees it; the event must
  // keep its EXISTING ref or deriveCheckpointTelemetry splits one checkpoint's history across two keys. Passing one
  // id for both — the obvious simplification — silently breaks one side or the other.
  const { db, memberId } = await seedMember();
  await markCheckpointClosed(db, memberId, { assetId: 'RBLD-B4', eventRef: 'RBD-CHK', phase: 'rebuild' });

  const prog = await db.query(`select 1 from session_progress where member_id = $1 and session_id = 'RBLD-B4'`, [memberId]);
  assert.equal(prog.rows.length, 1, 'progress row is keyed by the CURRICULUM id');
  assert.equal(await crossCount(db, memberId, 'RBD-CHK'), 1, 'the event keeps the ref already in every member log');
  assert.equal(await crossCount(db, memberId, 'RBLD-B4'), 0, 'and does NOT start a second history under the asset id');
});

test('the forecast reads a crossed checkpoint as done (behaviour unchanged — this was never the broken half)', async () => {
  const { db, memberId } = await seedMember();
  await markCheckpointClosed(db, memberId, { assetId: 'RWR-CHK', eventRef: 'RWR-CHK', phase: 'rewire' });
  const f = await getForecast(db, memberId);
  const chk = f.phases.flatMap((p) => p.items).find((i) => i.id === 'RWR-CHK');
  assert.equal(chk?.state, 'done');
});

test('THE COUNTERS NOW AGREE: 3 sessions + 1 checkpoint reads as 4 completions, not 3', async () => {
  // The number that was wrong on Greg's account. Sessions were counted, checkpoints weren't.
  const { db, memberId } = await seedMember();
  for (const s of ['RWR-W1', 'RWR-W2', 'RWR-W3']) await markSessionClosed(db, memberId, s);
  await markCheckpointClosed(db, memberId, { assetId: 'RWR-CHK', eventRef: 'RWR-CHK', phase: 'rewire' });

  const closed = (
    await db.query<{ n: string }>(`select count(*) n from session_progress where member_id = $1 and status='closed'`, [memberId])
  ).rows[0]!.n;
  assert.equal(Number(closed), 4, 'a phase is three Sessions AND its Checkpoint');

  const evs = await getMemberEvents(db, memberId);
  assert.equal(deriveSessionTelemetry(evs).filter((s) => s.closed).length, 3, 'three Sessions closed');
  const cp = deriveCheckpointTelemetry(evs);
  assert.equal(cp.length, 1);
  assert.equal(cp[0]!.crossed, true, 'and the Checkpoint shows as crossed exactly once');
});

test('a checkpoint closed BEFORE this shipped still crosses cleanly (no double-count on the backfill)', async () => {
  // Greg (a real member) already has gates set and no progress row. The first call after deploy must record the row
  // WITHOUT emitting a second crossing for a gateway they crossed days ago... except we cannot tell that state
  // apart from a genuine first crossing, so it emits. That is deliberate: an event that fires once too often for a
  // pre-existing account is recoverable; a completion that never records is not. Documented, not accidental.
  const { db, memberId } = await seedMember();
  await db.query(`insert into phase_gate (member_id, gate) values ($1, 'rewire_checkpoint_passed')`, [memberId]);

  await markCheckpointClosed(db, memberId, { assetId: 'RWR-CHK', eventRef: 'RWR-CHK', phase: 'rewire' });
  assert.equal(await crossCount(db, memberId, 'RWR-CHK'), 1, 'the backfilling call records the crossing');
  await markCheckpointClosed(db, memberId, { assetId: 'RWR-CHK', eventRef: 'RWR-CHK', phase: 'rewire' });
  assert.equal(await crossCount(db, memberId, 'RWR-CHK'), 1, 'and every call after it is silent');
});
