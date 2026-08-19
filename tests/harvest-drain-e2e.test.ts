import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { rewireOpening, applyRewireTurn } from '../lib/agent/rewire.ts';
import { drainHarvest, keepProposal, type KeeperProposal } from '../lib/agent/harvest.ts';

// The gap the passing playbook-run-chain test left open: it RE-IMPLEMENTS the persist for ONE item. The real action
// runs the accumulating priorN drain (drainHarvest) across MANY turns, with the state round-tripping through the
// server-action boundary each turn (client → serialize → server → serialize → client). Prod shows ZERO session
// keepers across all members, so SOMETHING in that real flow drops them. This drives the REAL arc + REAL drain +
// a faithful JSON round-trip (mimicking the action serialization) and asserts every true line lands as a keeper.

const FIVE_LIES = ["it's just age", 'the drink helps me unwind', "no room for me", "I'm not that person", "too late to start"];
const roundtrip = <T>(s: T): T => JSON.parse(JSON.stringify(s)); // the client ⇄ server-action serialization boundary

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

test('Rewire W1 e2e — the REAL drain + state round-trip lands EVERY true line as a Playbook keeper', async () => {
  const { db, memberId } = await freshDb();
  // Walk the five domains into the affirm (true-line) stage — round-tripping state each turn as the action does.
  let t = rewireOpening();
  FIVE_LIES.forEach((lie, i) => {
    t = applyRewireTurn(roundtrip(t.state), [], lie, { text: i === FIVE_LIES.length - 1 ? 'What is the honest line you would put in place of that?' : 'That is the story.' });
  });
  assert.equal(t.state.stage, 'affirm', 'after the five domains, into the true-line turn');

  // Write TWO true lines, each its own turn, draining EXACTLY as app/rewire/actions.ts does: prev = the client-sent
  // state, next = the turn result — then the client stores the returned state for the next turn.
  const lines = ['My body responds to what I ask of it — at any age', 'I make room for myself without apology'];
  const offered: KeeperProposal[] = [];
  for (const line of lines) {
    const prev = roundtrip(t.state);                       // client sends the last state back
    t = applyRewireTurn(prev, [], line, { text: 'Kept. Any others?' });
    offered.push(...await drainHarvest(db, memberId, prev, t.state, 'rewire')); // the REAL drain the action runs
    t = { ...t, state: roundtrip(t.state) };                // client stores the returned state
  }

  // THE GATE (2026-08-19). The drain OFFERS; nothing is in the Playbook until she taps Keep. Asserted explicitly,
  // because "the keeper is there" would now pass for the wrong reason if anything ever committed early again.
  assert.deepEqual(offered.map((o) => o.body), lines, 'both lines come back as offers, in order, verbatim');
  const { rows: beforeKeep } = await db.query<{ n: number }>(
    `select count(*)::int as n from playbook_entry where member_id = $1`, [memberId],
  );
  assert.equal(beforeKeep[0]!.n, 0, 'NOTHING is in the Playbook before she keeps — this is Donna\'s bad-keeper fix');

  // She taps Keep on both — through the real commit path, round-tripped as the client action sends it.
  for (const o of offered) await keepProposal(db, memberId, roundtrip(o));

  const { rows } = await db.query<{ body: string; source_label: string; keeper_type: string; source_kind: string }>(
    `select body, source_label, keeper_type, source_kind from playbook_entry where member_id = $1 order by sort_order`,
    [memberId],
  );
  assert.equal(rows.length, 2, `both kept true lines should land (got ${rows.length}) — 0/1 reproduces the prod drop`);
  assert.deepEqual(rows.map((r) => r.body), lines, 'the exact member words, in order');
  assert.ok(rows.every((r) => r.keeper_type === 'principle' && r.source_kind === 'own'), 'principle keepers, source own');

  // ISOLATE emit: did the QI moment ALSO land? (harvestSignal now commits the keeper even if emit throws, so the
  // keeper landing alone doesn't prove emit worked.) prod has ZERO harvest_moment events — if pglite ALSO shows 0
  // here, emit has a JS-level bug both hit; if it shows 2, emit works and the prod failure is postgres.js/real-PG only.
  const { rows: moments } = await db.query<{ n: number }>(
    `select count(*)::int as n from member_event where member_id = $1 and kind = 'harvest_moment'`,
    [memberId],
  );
  console.log(`[e2e] harvest_moment rows on pglite: ${moments[0]!.n} (prod = 0)`);
  assert.equal(moments[0]!.n, 2, 'the QI moment also lands on pglite — if this is 0, emit throws here too (reproducible)');
});
