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

test('a MERGE (two originals refined to the same text) releases the duplicate — never renders twice', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'merge@x.com');
  await addItem(db, m, 'Lose 30 lbs', 0);
  await addItem(db, m, 'My fitness', 1);
  await addItem(db, m, 'Ride my bike', 2);

  await commitRefinement(db, m, {
    items: [
      { original: 'Lose 30 lbs', text: 'Reach 190 lbs by Oct 15', tier: 'top' },
      { original: 'My fitness', text: 'Reach 190 lbs by Oct 15', tier: 'top' }, // the merge
      { original: 'Ride my bike', text: 'Ride my bike, 2-3x a week', tier: 'important' },
    ],
    top3: ['Reach 190 lbs by Oct 15'],
  });

  const active = (await getReclaimItems(db, m)).filter((i) => i.tier !== 'no_longer_central').map((i) => i.text);
  assert.equal(active.filter((t) => /Reach 190 lbs/.test(t)).length, 1, 'the merged item shows exactly once');
  assert.equal(new Set(active.map((t) => t.toLowerCase())).size, active.length, 'no exact-text duplicates on the active list');
});

test('getReclaimItems collapses pre-existing exact-text duplicate rows (defense for already-dirty data)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await seedMember(db, 'dupe@x.com');
  await addItem(db, m, 'Eat more vegetables, drink less wine', 0);
  await addItem(db, m, 'Eat more vegetables, drink less wine', 1); // a duplicate row already in the table
  const items = await getReclaimItems(db, m);
  assert.equal(items.length, 1, 'exact-text duplicate rows collapse to one');
});

// ── ADDITIONS — Greg's C1 question 5, "which new priorities have emerged?" ────────────────────────────────────
// The re-audit found C1 could re-rank and re-word what was already there but could not ADMIT a goal that was not
// on the list. `emerging` looked like coverage and is not — it is a tier for an EXISTING item.

async function freshList(db: Db, email: string): Promise<string> {
  const m = await seedMember(db, email);
  await addItem(db, m, 'Ride the loop again', 0);
  await addItem(db, m, 'Sleep like I used to', 1);
  await addItem(db, m, 'See my brother more', 2);
  return m;
}

test('C1 additions · a new goal lands on the list, tiered, without disturbing the existing items', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await freshList(db, 'add@x.test');

  await commitRefinement(db, m, {
    items: [
      { original: 'Ride the loop again', text: 'Ride the loop again', tier: 'top' },
      { original: 'Sleep like I used to', text: 'Sleep like I used to', tier: 'important' },
      { original: 'See my brother more', text: 'See my brother more', tier: 'important' },
    ],
    top3: ['Ride the loop again'],
    added: [{ text: 'Get back on the water', tier: 'top', emergedFrom: 'talking about the summers' }],
  });

  const after = await getReclaimItems(db, m);
  assert.equal(after.length, 4, 'the new goal is on the list');
  const fresh = after.find((i) => i.text === 'Get back on the water');
  assert.ok(fresh, 'the added item exists');
  assert.equal(fresh!.tier, 'top', 'it carries the tier the member placed it in');
  // NEVER REMOVES — the contract the whole commit path is built around.
  for (const t of ['Ride the loop again', 'Sleep like I used to', 'See my brother more']) {
    assert.ok(after.some((i) => i.text === t), `${t} survived`);
  }
});

test('C1 additions · a new item does NOT leapfrog the member\'s own top-3 ordering', async () => {
  // reclaim_item.sort_order defaults to 0, so an addition that skips the reorder pass silently outranks the three
  // items they just named as their top priorities. Caught by writing this test, not by the typechecker.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await freshList(db, 'order@x.test');

  await commitRefinement(db, m, {
    items: [
      { original: 'Ride the loop again', text: 'Ride the loop again', tier: 'top' },
      { original: 'Sleep like I used to', text: 'Sleep like I used to', tier: 'top' },
      { original: 'See my brother more', text: 'See my brother more', tier: 'important' },
    ],
    top3: ['Ride the loop again', 'Sleep like I used to'],
    added: [{ text: 'Get back on the water', tier: 'important' }],
  });

  const after = await getReclaimItems(db, m);
  assert.equal(after[0]!.text, 'Ride the loop again', 'their first choice leads');
  assert.equal(after[1]!.text, 'Sleep like I used to', 'their second follows');
  assert.ok(after.findIndex((i) => i.text === 'Get back on the water') >= 2, 'the new item sits below the named top-3');
});

test('C1 additions · a duplicate is a reword the model mis-filed, not a second row', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await freshList(db, 'dupe@x.test');

  await commitRefinement(db, m, {
    items: [{ original: 'Ride the loop again', text: 'Ride the loop again', tier: 'top' }],
    top3: [],
    added: [{ text: 'ride the loop again', tier: 'important' }], // same goal, different case
  });

  const after = await getReclaimItems(db, m);
  assert.equal(after.filter((i) => i.text.toLowerCase() === 'ride the loop again').length, 1, 'no duplicate row');
  assert.equal(after.length, 3, 'the list did not grow');
});

test('C1 additions · absent `added` behaves exactly as before', async () => {
  // Most refinements add nothing. An absent list must read as "nothing new came up", never as a malformed call.
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const m = await freshList(db, 'none@x.test');

  const r = await commitRefinement(db, m, {
    items: [{ original: 'Ride the loop again', text: 'Ride the loop again, properly', tier: 'top' }],
    top3: ['Ride the loop again, properly'],
  });
  assert.equal(r.ok, true);
  const after = await getReclaimItems(db, m);
  assert.equal(after.length, 3, 'no phantom item');
  assert.ok(after.some((i) => i.text === 'Ride the loop again, properly'), 'the reword applied');
});
