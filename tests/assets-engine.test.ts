// Asset engine against a real (ephemeral) Postgres via pglite: completion persistence,
// telemetry events, upsert-on-recompletion, and the gating completed-set (incl. R-1 from IDQ).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { startAsset, completeAsset, dropOffAsset, completedCodes } from '../lib/assets/engine.ts';
import { assignVariant } from '../lib/assets/variant.ts';
import { getAssetDefinition } from '../lib/assets/definitions.ts';

async function dbWithMember(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const r = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('A','a@example.com') returning member_id`,
  );
  return { db, memberId: r.rows[0]!.member_id };
}

const count = async (db: Db, sql: string, params: unknown[]) =>
  (await db.query<{ n: number }>(sql, params)).rows[0]!.n;

test('start + complete persists one completion and emits started+completed telemetry', async () => {
  const { db, memberId } = await dbWithMember();
  const variant = assignVariant(memberId, 'R-4');
  const def = getAssetDefinition('R-4', variant);

  await startAsset(db, { memberId, code: 'R-4', variant });
  await completeAsset(db, {
    memberId, code: 'R-4', variant, version: def.version,
    outputs: { excavated: ['the racer', 'the early riser', 'the planner'] },
    reflection: 'the racer still has a pulse', timeMs: 42000,
  });

  assert.equal(await count(db, `select count(*)::int n from asset_completion where member_id=$1`, [memberId]), 1);
  assert.equal(await count(db, `select count(*)::int n from asset_event where member_id=$1 and event_type='started'`, [memberId]), 1);
  assert.equal(await count(db, `select count(*)::int n from asset_event where member_id=$1 and event_type='completed'`, [memberId]), 1);

  const row = (await db.query<{ variant: string; asset_version: string; reflection: string }>(
    `select variant, asset_version, reflection from asset_completion where member_id=$1`, [memberId])).rows[0]!;
  assert.equal(row.variant, variant);
  assert.equal(row.asset_version, def.version);
});

test('re-completing upserts (one row) and records a second completed event', async () => {
  const { db, memberId } = await dbWithMember();
  await completeAsset(db, { memberId, code: 'W-1', version: '0.1-draft', outputs: { response: 'first' } });
  await completeAsset(db, { memberId, code: 'W-1', version: '0.1-draft', outputs: { response: 'second' } });

  assert.equal(await count(db, `select count(*)::int n from asset_completion where member_id=$1`, [memberId]), 1);
  assert.equal(await count(db, `select count(*)::int n from asset_event where member_id=$1 and event_type='completed'`, [memberId]), 2);
  const out = (await db.query<{ outputs: { response: string } }>(
    `select outputs from asset_completion where member_id=$1`, [memberId])).rows[0]!;
  assert.equal(out.outputs.response, 'second'); // latest wins
});

test('drop-off telemetry is captured with a point', async () => {
  const { db, memberId } = await dbWithMember();
  await dropOffAsset(db, { memberId, code: 'B-1', point: 'step-2', timeMs: 5000 });
  assert.equal(await count(db, `select count(*)::int n from asset_event where member_id=$1 and event_type='drop_off' and drop_off_point='step-2'`, [memberId]), 1);
});

test('completedCodes includes R-1 once a baseline IDQ exists', async () => {
  const { db, memberId } = await dbWithMember();
  await completeAsset(db, { memberId, code: 'R-4', variant: 'a', version: '0.1-draft' });
  assert.deepEqual([...(await completedCodes(db, memberId))].sort(), ['R-4']);

  await db.query(
    `insert into idq_retake (member_id,cycle_indicator,sequence_no,responses,physical_score,self_score,social_score,outlook_score,id_score_raw,id_score)
     values ($1,1,0,'[]'::jsonb,18,18,18,18,72,60)`, [memberId]);
  assert.deepEqual([...(await completedCodes(db, memberId))].sort(), ['R-1', 'R-4']);
});
