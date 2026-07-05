import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { persistGrintaReading, latestGrintaReading, baselineResponsesMap } from '../lib/grinta/survey/store.ts';
import { scoreGrinta } from '../lib/grinta/survey/scoring.ts';
import { ONBOARDING_BASELINE_ITEMS } from '../lib/grinta/survey/instrument.ts';

async function seedMember(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email, identity_noun, named_door)
       values ('Tom Miller','tom@x.com','Cyclist','body') returning member_id`,
    )
  ).rows[0]!.member_id;
  return { db, memberId };
}

test('grinta reading · baseline persists as sequence 0 with the 4 strands and NO delta', async () => {
  const { db, memberId } = await seedMember();
  const responses = [5, 5, 5, 3, 3, 3, 1, 1, 1, 4, 4, 4];
  const score = scoreGrinta(ONBOARDING_BASELINE_ITEMS, responses);
  await persistGrintaReading(db, memberId, { source: 'onboarding', responses: baselineResponsesMap(responses), score });

  const latest = (await latestGrintaReading(db, memberId))!;
  assert.equal(latest.sequenceNo, 0);
  assert.equal(latest.source, 'onboarding');
  assert.equal(latest.composite, 3.25);
  assert.equal(latest.strands.reconnect, 5);
  assert.equal(latest.strands.rebuild, 1);
  assert.equal(latest.changePct, null, 'no delta on the baseline');
  assert.equal(latest.direction, null);
  // the raw, self-describing responses round-trip (so a Checkpoint can recompute grit)
  const { rows } = await db.query<{ responses: Record<string, number> }>(
    `select responses from grinta_reading where member_id = $1 and sequence_no = 0`,
    [memberId],
  );
  assert.equal(rows[0]!.responses.G1Q1, 5);
  assert.equal(rows[0]!.responses.B1Q1, 1);
});

test('grinta reading · a second reading auto-increments the sequence and computes movement vs the prior', async () => {
  const { db, memberId } = await seedMember();
  const base = scoreGrinta(ONBOARDING_BASELINE_ITEMS, [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]); // composite 4
  await persistGrintaReading(db, memberId, { source: 'onboarding', responses: baselineResponsesMap([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]), score: base });

  // a checkpoint-style follow-up with a higher composite → positive change
  const next = scoreGrinta(ONBOARDING_BASELINE_ITEMS, [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]); // composite 5
  await persistGrintaReading(db, memberId, { source: 'checkpoint', responses: baselineResponsesMap([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]), score: next });

  const latest = (await latestGrintaReading(db, memberId))!;
  assert.equal(latest.sequenceNo, 1);
  assert.equal(latest.source, 'checkpoint');
  assert.equal(latest.composite, 5);
  assert.equal(latest.changePct, 25, '(5 − 4) / 4 × 100 = 25%');
  assert.equal(latest.direction, 'up');
});

test('grinta reading · re-persisting the same sequence is idempotent (no duplicate row)', async () => {
  const { db, memberId } = await seedMember();
  const score = scoreGrinta(ONBOARDING_BASELINE_ITEMS, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
  const input = { source: 'onboarding' as const, responses: baselineResponsesMap([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]), score };
  await persistGrintaReading(db, memberId, input);
  await persistGrintaReading(db, memberId, input); // second attempt at seq 0 → conflict do-nothing
  const { rows } = await db.query<{ n: string }>(`select count(*)::text as n from grinta_reading where member_id = $1`, [memberId]);
  assert.equal(rows[0]!.n, '1');
});
