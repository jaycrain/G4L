import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { submitIdq } from '../lib/gateway/flow.ts';
import { completeAsset } from '../lib/assets/engine.ts';
import { selectTrigger, maybeTriggerDraft } from '../lib/founder/triggers.ts';
import { listPending } from '../lib/founder/store.ts';

// No ANTHROPIC_API_KEY in tests → generateDraft uses the deterministic scripted fallback.

async function dbWithMember(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email, identity_noun, named_door, reclaim_list)
     values ('Greg Welk','greg@example.com','RUNNER','career_cliff',
             '["a","b","c","d","e","f","g"]'::jsonb) returning member_id`,
  );
  return { db, memberId: r.rows[0]!.member_id };
}

test('selectTrigger maps events to moments + stable keys', () => {
  assert.deepEqual(selectTrigger({ kind: 'idq', sequenceNo: 0 }), { moment: 'post_idq_welcome', triggerKey: 'idq:0' });
  assert.deepEqual(selectTrigger({ kind: 'idq', sequenceNo: 2 }), { moment: 'retake_commentary', triggerKey: 'idq:2' });
  assert.deepEqual(selectTrigger({ kind: 'milestone', assetCode: 'R-4', assetName: 'Identity Excavation' }), {
    moment: 'milestone_commentary',
    triggerKey: 'milestone:R-4',
  });
});

test('completing the baseline IDQ auto-drafts a welcome into the queue', async () => {
  const { db, memberId } = await dbWithMember();
  const res = await submitIdq(db, memberId, Array.from({ length: 24 }, () => 3));
  assert.ok(res.ok && res.sequenceNo === 0);

  const id = await maybeTriggerDraft(db, memberId, { kind: 'idq', sequenceNo: 0 });
  assert.ok(id, 'a draft was created');

  const pending = await listPending(db);
  assert.equal(pending.length, 1);
  assert.equal(pending[0]!.operating_moment, 'post_idq_welcome');
  assert.match(pending[0]!.draft_body, /—\s*Jay\s*$/);
});

test('one event drafts at most once (idempotent)', async () => {
  const { db, memberId } = await dbWithMember();
  await submitIdq(db, memberId, Array.from({ length: 24 }, () => 3));

  const first = await maybeTriggerDraft(db, memberId, { kind: 'idq', sequenceNo: 0 });
  const second = await maybeTriggerDraft(db, memberId, { kind: 'idq', sequenceNo: 0 });
  assert.ok(first);
  assert.equal(second, null, 'the repeat did not draft again');
  assert.equal((await listPending(db)).length, 1);
});

test('completing an asset auto-drafts a milestone note grounded in the asset', async () => {
  const { db, memberId } = await dbWithMember();
  await submitIdq(db, memberId, Array.from({ length: 24 }, () => 3)); // baseline so context has a score
  await completeAsset(db, { memberId, code: 'R-4', version: '1.0.0', outputs: {} });

  const id = await maybeTriggerDraft(db, memberId, { kind: 'milestone', assetCode: 'R-4', assetName: 'Identity Excavation' });
  assert.ok(id);
  const pending = await listPending(db);
  const milestone = pending.find((d) => d.operating_moment === 'milestone_commentary');
  assert.ok(milestone, 'milestone draft queued');
  assert.match(milestone!.draft_body, /Identity Excavation/);
});

test('a retake drafts separately from the baseline', async () => {
  const { db, memberId } = await dbWithMember();
  await submitIdq(db, memberId, Array.from({ length: 24 }, () => 3));
  await maybeTriggerDraft(db, memberId, { kind: 'idq', sequenceNo: 0 });
  const retake = await submitIdq(db, memberId, Array.from({ length: 24 }, () => 4));
  assert.ok(retake.ok && retake.sequenceNo === 1);
  const id = await maybeTriggerDraft(db, memberId, { kind: 'idq', sequenceNo: retake.sequenceNo });
  assert.ok(id, 'retake drafted (different key than baseline)');
  assert.equal((await listPending(db)).length, 2);
});

test('auto-trigger is graceful — unknown member never throws', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const id = await maybeTriggerDraft(db, '00000000-0000-0000-0000-000000000000', { kind: 'idq', sequenceNo: 0 });
  assert.equal(id, null);
});
