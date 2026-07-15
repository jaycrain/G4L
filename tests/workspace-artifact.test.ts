import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { emitHarvestMoment, commitKeeper } from '../lib/agent/harvest.ts';
import { saveArcSession } from '../lib/agent/arc-session.ts';
import { readArtifact } from '../lib/workspace/artifact.ts';

// Redesign Layer 3: the workspace canvas plays back the member's COMMITTED words. This proves the write→read contract
// end to end — the W1 true lines the arc harvests (principle keepers, state='kept') are exactly what readArtifact('w1')
// surfaces on the left. (The empty-left in the walk was poll latency, not a broken commit — the chat client now pushes
// a refresh the moment a turn lands.)

async function seedMember(db: Db): Promise<string> {
  return (await db.query<{ member_id: string }>(`insert into member_profile (display_name, email) values ('Pat', 'pat-art@x.com') returning member_id`)).rows[0]!.member_id;
}

test('w1 canvas is empty until a line commits, then plays back the true lines verbatim', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db);

  const before = await readArtifact(db, m, 'w1');
  assert.equal(before.slots.length, 1);
  assert.equal(before.slots[0]!.value, null, 'no keeper yet → the frame stands alone (placeholder shows)');

  for (const line of ['There’s room in my life to be myself.', 'Start with the next decision, make it a good one.']) {
    const momentId = await emitHarvestMoment(db, m, {
      destinationIntent: 'keeper',
      keeperType: 'principle',
      surface: 'rewire',
      sourceRef: { kind: 'affirmation', ref: 'affirmation', label: 'Your true line' },
      payloadRef: line,
    });
    await commitKeeper(db, m, { momentId, keeperType: 'principle', section: 'own_words', body: line, state: 'kept', source: { kind: 'own', ref: 'affirmation', label: 'Your true line' } });
  }

  const after = await readArtifact(db, m, 'w1');
  const value = after.slots[0]!.value ?? '';
  assert.match(value, /room in my life to be myself/, 'first true line plays back on the left');
  assert.match(value, /next decision, make it a good one/, 'second true line plays back on the left');
});

test('b3 canvas shows the coach-locked plan from the live session, before the final commit', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db);

  // Nothing committed, nothing in flight → the frame stands alone.
  assert.equal((await readArtifact(db, m, 'b3')).slots[0]!.value, null);

  // The coach has LOCKED both changes this turn (persisted to arc_session by the per-turn save) — not yet confirmed.
  await saveArcSession(db, m, 'rebuild', { stage: 'pilot', collected: { pilotActivity: 'a 10-minute walk after dinner, 3 days', pilotDiet: 'a vegetable at dinner, 5 days' } }, [{ role: 'agent', text: '…' }], 'b3');

  const art = await readArtifact(db, m, 'b3');
  assert.match(art.slots[0]!.value ?? '', /10-minute walk/, 'movement change shows before confirm');
  assert.match(art.slots[1]!.value ?? '', /vegetable at dinner/, 'nutrition change shows before confirm');
});

test('c3 canvas shows the coach-named Quality Day from the live session, before the final commit', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db);
  assert.equal((await readArtifact(db, m, 'c3')).slots[0]!.value, null);

  await saveArcSession(db, m, 'reclaim', { stage: 'quality', collected: { pendingQualityDay: { nonNegotiables: ['moved my body', 'some calm'], contributors: ['real connection'], disruptors: ['poor sleep'] } } }, [{ role: 'agent', text: '…' }], 'c3');

  const art = await readArtifact(db, m, 'c3');
  assert.match(art.slots[0]!.value ?? '', /moved my body/, 'non-negotiables show before confirm');
  assert.match(art.slots[1]!.value ?? '', /real connection/, 'what lifts a day shows');
  assert.match(art.slots[2]!.value ?? '', /poor sleep/, 'what drains one shows');
});
