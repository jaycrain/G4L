import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { getDashboard } from '../lib/gateway/flow.ts';
import { anchorFirst, isAnchorTier } from '../lib/reclaim/anchor.ts';

// THE ANCHOR MUST SURVIVE THE PROJECTION.
//
// getDashboard read `tier`, used it to decide `released`, and then dropped it one line before building
// reclaimItems. Two symptoms, one cause: the Reclaim List subpage could not star the anchor and the Companion
// could not see it — the second being a breach of the standing rule that no data the member can see is invisible
// to the agent.
//
// Modelled on Jay's real list (2026-08-12): one outcome marked `top`, four `important` items that are the means
// to it, and the anchor sitting FOURTH in stored order — which is what made the bug visible in the first place.

async function seed(db: Db, items: [string, string | null][]): Promise<string> {
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email) values ('J','j@grintaforlife.test') returning member_id`,
    )
  ).rows[0]!.member_id;
  for (let i = 0; i < items.length; i++) {
    const [text, tier] = items[i]!;
    await db.query(
      `insert into reclaim_item (member_id, text, category, sort_order, tier) values ($1,$2,'physical',$3,$4)`,
      [memberId, text, i, tier],
    );
  }
  return memberId;
}

const JAYS_LIST: [string, string | null][] = [
  ['Eating oatmeal, salad, and a light dinner', 'important'],
  ['Yoga and kettlebell work 3 times per week', 'important'],
  ['VO2 Max and Threshold interval rides', 'important'],
  ['Finish in top 20% of my age group at Big Sugar', 'top'], // the anchor, stored fourth
  ['One sustained climb per weekend', 'important'],
];

test('the anchor reaches the dashboard, named and first', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = await seed(db, JAYS_LIST);

  const dash = (await getDashboard(db, memberId))!;
  assert.ok(dash, 'dashboard built');

  assert.equal(dash.reclaimAnchor, 'Finish in top 20% of my age group at Big Sugar', 'the anchor is named outright');
  assert.equal(dash.reclaimItems[0]!.text, 'Finish in top 20% of my age group at Big Sugar', 'and leads the list');
  assert.equal(dash.reclaimItems[0]!.anchor, true, 'flagged, so the subpage can star it');
  assert.equal(dash.reclaimList[0], 'Finish in top 20% of my age group at Big Sugar', 'the agent-facing list too');

  // EVERYTHING ELSE KEEPS THE MEMBER'S ORDER. This lifts one item; it is not a re-ranking of their list.
  assert.deepEqual(
    dash.reclaimItems.slice(1).map((i) => i.text),
    [
      'Eating oatmeal, salad, and a light dinner',
      'Yoga and kettlebell work 3 times per week',
      'VO2 Max and Threshold interval rides',
      'One sustained climb per weekend',
    ],
  );
  assert.equal(dash.reclaimItems.filter((i) => i.anchor).length, 1, 'exactly one anchor');
});

test('a list with no refinement yet has no anchor — and does not invent one', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = await seed(db, [['Ride again', null], ['Sleep properly', null]]);

  const dash = (await getDashboard(db, memberId))!;
  assert.equal(dash.reclaimAnchor, null, 'before C1 there is no anchor, and null is the honest answer');
  assert.deepEqual(dash.reclaimItems.map((i) => i.anchor), [false, false]);
  assert.deepEqual(dash.reclaimItems.map((i) => i.text), ['Ride again', 'Sleep properly'], 'order untouched');
});

test('a released item is never the anchor, even if it somehow carries the tier', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = await seed(db, [['Kept', 'top'], ['Let go of', 'no_longer_central']]);

  const dash = (await getDashboard(db, memberId))!;
  assert.equal(dash.reclaimAnchor, 'Kept');
  assert.equal(dash.releasedReclaimItems.length, 1, 'the released item stays kept-and-restorable, just not active');
  assert.equal(dash.reclaimItems.length, 1);
});

test('anchorFirst is stable — only the anchor moves', () => {
  const xs = [{ t: 'a' }, { t: 'b' }, { t: 'c' }, { t: 'd' }];
  assert.deepEqual(anchorFirst(xs, (x) => x.t === 'c').map((x) => x.t), ['c', 'a', 'b', 'd']);
  assert.deepEqual(anchorFirst(xs, () => false).map((x) => x.t), ['a', 'b', 'c', 'd'], 'no anchor changes nothing');
  assert.equal(isAnchorTier('top'), true);
  assert.equal(isAnchorTier('important'), false);
  assert.equal(isAnchorTier(null), false);
});
