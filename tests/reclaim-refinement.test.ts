import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { getReclaimItems } from '../lib/beats/store.ts';
import { commitRefinement, latestRefinement, isTier, TIER_LABEL } from '../lib/reclaim/refinement-store.ts';

// Reclaim C1 Step 2 — the member-CONFIRMED refinement commit. The safety-critical member-data path: it reword+tiers
// the LIVE Reclaim List (member-authorized, propose→confirm→commit) and keeps the pre-state as history (RC-4). NEVER
// removes an item. Proven against pglite before the coaching layer sits on top.

async function seedMember(db: Db, email: string): Promise<string> {
  return (await db.query<{ member_id: string }>(`insert into member_profile (display_name, email) values ('Pat', $1) returning member_id`, [email])).rows[0]!.member_id;
}
async function addItem(db: Db, memberId: string, text: string, order: number): Promise<void> {
  await db.query(
    `insert into reclaim_item (member_id, text, category, rhythm, sort_order) values ($1,$2,'self','weekly',$3)`,
    [memberId, text, order],
  );
}

test('isTier / labels · only the four Greg tiers are valid', () => {
  assert.equal(isTier('top'), true);
  assert.equal(isTier('no_longer_central'), true);
  assert.equal(isTier('someday'), false);
  assert.equal(TIER_LABEL.top, 'Top Priorities Now');
  assert.equal(TIER_LABEL.no_longer_central, 'No Longer Central');
});

test('commitRefinement · rewords + tiers the LIVE list, reorders top-3 first, never removes', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-refine@x.com');
  await addItem(db, m, 'be healthier', 0);
  await addItem(db, m, 'get my life together', 1);
  await addItem(db, m, 'see friends more', 2);

  const r = await commitRefinement(db, m, {
    items: [
      { original: 'be healthier', text: 'feel physically capable and steady again', tier: 'top' },
      { original: 'get my life together', text: 'stop living in reaction mode', tier: 'emerging' },
      { original: 'see friends more', text: 'see friends more', tier: 'important' },
    ],
    top3: ['feel physically capable and steady again', 'see friends more'],
  });
  assert.equal(r.ok, true);
  assert.equal(r.applied, 3);

  const items = await getReclaimItems(db, m);
  assert.equal(items.length, 3, 'nothing removed — all three survive');
  // reworded text landed on the live list
  assert.ok(items.some((i) => i.text === 'feel physically capable and steady again'));
  assert.ok(items.some((i) => i.text === 'stop living in reaction mode'));
  // tiers set as an attribute
  assert.equal(items.find((i) => i.text === 'feel physically capable and steady again')!.tier, 'top');
  assert.equal(items.find((i) => i.text === 'stop living in reaction mode')!.tier, 'emerging');
  // order: the two top-3 lead (in their order), then the rest
  assert.equal(items[0]!.text, 'feel physically capable and steady again', 'top-3 #1 leads');
  assert.equal(items[1]!.text, 'see friends more', 'top-3 #2 next');
  assert.equal(items[2]!.text, 'stop living in reaction mode', 'the non-top-3 item trails');
});

test('commitRefinement · "No Longer Central" is the lowest tier, NOT a delete', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-release@x.com');
  await addItem(db, m, 'run a marathon', 0);
  await addItem(db, m, 'write again', 1);

  await commitRefinement(db, m, {
    items: [
      { original: 'run a marathon', text: 'run a marathon', tier: 'no_longer_central' },
      { original: 'write again', text: 'write again', tier: 'top' },
    ],
    top3: ['write again'],
  });
  const items = await getReclaimItems(db, m);
  assert.equal(items.length, 2, 'the "no longer central" item is kept, not deleted');
  const marathon = items.find((i) => i.text === 'run a marathon')!;
  assert.equal(marathon.tier, 'no_longer_central');
  assert.equal(items[0]!.text, 'write again', 'the top item leads; the released one trails');
});

test('latestRefinement · keeps the pre-refinement state as history (RC-4 retrieval)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'pat-history@x.com');
  await addItem(db, m, 'be healthier', 0);

  assert.equal(await latestRefinement(db, m), null, 'no history before any refinement');
  await commitRefinement(db, m, {
    items: [{ original: 'be healthier', text: 'feel physically capable again', tier: 'top' }],
    top3: ['feel physically capable again'],
  });
  const hist = await latestRefinement(db, m);
  assert.ok(hist, 'history present after a commit');
  assert.equal(hist!.preRefinement[0]!.text, 'be healthier', 'the ORIGINAL wording is retained as history');
  assert.equal(hist!.refinement.items[0]!.text, 'feel physically capable again', 'the refined result is stored too');
});
