import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { rewireOpening, applyRewireTurn } from '../lib/agent/rewire.ts';
import { emitHarvestMoment, commitKeeper } from '../lib/agent/harvest.ts';
import { runnablePlay } from '../lib/playbook/runnable.ts';

// The question this locks: when a member walks the CURRENT conversational Rewire W1 arc, does the "true line"
// play (a) get harvested, (b) land in the Playbook as a keeper with the source_label the run-map keys on, and
// (c) come back RUNNABLE ("Run it again with your Companion" → Session w1)? This is the chain Jay's account was
// missing (his Rewire was completed via the legacy session path — no arc_session rows, so no play harvest).

const FIVE_LIES = ["it's just age", 'the drink helps me unwind', "no room for me", "I'm not that person", "too late to start"];
const LAST_BEAT =
  'That last one is heavy, and you said it plainly. Look at all five — each keeps you where you are: the campaign. ' +
  'What’s the honest line you’d put in place of “it’s too late”?';

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const raw = new PGlite();
  await raw.waitReady;
  const db: Db = { query: (t, p) => (raw as any).query(t, p), exec: (t) => (raw as any).exec(t) };
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('T','t@t.com') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

test('Rewire W1 arc → the "true line" play harvests, lands as a runnable keeper (Session w1)', async () => {
  // (a) drive the real arc to the turn, then write a true line → the arc harvests it.
  let t = rewireOpening();
  FIVE_LIES.forEach((lie, i) => {
    t = applyRewireTurn(t.state, [], lie, { text: i === FIVE_LIES.length - 1 ? LAST_BEAT : 'That’s the story.' });
  });
  assert.equal(t.state.stage, 'affirm', 'after the five domains, into the turn');
  t = applyRewireTurn(t.state, [], 'My body responds to what I ask of it — at any age', { text: 'Kept. Any others?' });

  const item = (t.state.pendingHarvest ?? [])[0];
  assert.ok(item, 'the arc harvested the true line');
  assert.equal(item!.keeperType, 'principle', 'a true line is a principle keeper');
  assert.equal(item!.label, 'Your true line', 'the forge label the run-map keys on — must not drift');

  // (b) persist it EXACTLY as app/rewire/actions.ts persistRewireHarvest does.
  const { db, memberId } = await freshDb();
  const momentId = await emitHarvestMoment(db, memberId, {
    destinationIntent: item!.destinationIntent,
    keeperType: item!.keeperType as 'principle',
    surface: 'rewire',
    sourceRef: { kind: item!.kind, ref: item!.kind, label: item!.label ?? item!.kind },
    payloadRef: item!.payloadRef,
  });
  await commitKeeper(db, memberId, {
    momentId,
    keeperType: item!.keeperType as 'principle',
    section: 'own_words',
    body: item!.payloadRef,
    state: 'kept',
    source: { kind: 'own', ref: item!.kind, label: item!.label ?? item!.kind },
  });

  const { rows } = await db.query<{ keeper_type: string; state: string; source_kind: string; source_ref: string; source_label: string }>(
    `select keeper_type, state, source_kind, source_ref, source_label from playbook_entry where member_id = $1`,
    [memberId],
  );
  assert.equal(rows.length, 1);
  const kept = rows[0]!;
  assert.equal(kept.keeper_type, 'principle');
  assert.equal(kept.state, 'kept', 'a rewire true line lands KEPT (lives in "Your plays", not the review tray)');
  assert.equal(kept.source_label, 'Your true line');

  // (c) the kept keeper is RUNNABLE → the button resolves to Session w1.
  const run = runnablePlay({ source: { kind: kept.source_kind, ref: kept.source_ref, label: kept.source_label } });
  assert.ok(run, 'the harvested play is runnable');
  assert.equal(run!.sessionId, 'w1');
  assert.match(run!.ask, /go back through my Disinformation Audit/);
});
