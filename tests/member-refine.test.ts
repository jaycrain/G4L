import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { getReclaimItems } from '../lib/beats/store.ts';
import { addReclaimItemForMember, addDoorForMember, getMemberDoors, setMemberDoors, softSetMemberDoors, reconcileDoors } from '../lib/member/refine.ts';
import { emitHarvestMoment, commitKeeper } from '../lib/agent/harvest.ts';

async function seedMember(): Promise<{ db: Db; memberId: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const memberId = (
    await db.query<{ member_id: string }>(
      `insert into member_profile (display_name, email, identity_noun, named_door)
       values ('Tom Miller','tom@x.com','Cyclist','body') returning member_id`,
    )
  ).rows[0]!.member_id;
  await db.query(`insert into member_door (member_id, door_slug, is_primary, sort_order) values ($1,'body',true,0)`, [memberId]);
  return { db, memberId };
}

test('addReclaimItemForMember: a specific item is saved, categorized, and appended', async () => {
  const { db, memberId } = await seedMember();
  const r = await addReclaimItemForMember(db, memberId, 'ride before work without dreading it');
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.category, 'physical');
  const items = await getReclaimItems(db, memberId);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.text, 'ride before work without dreading it');

  // a second item appends (sort_order grows; not a reorder)
  const r2 = await addReclaimItemForMember(db, memberId, 'call my brother every week');
  assert.equal(r2.ok, true);
  const after = await getReclaimItems(db, memberId);
  assert.equal(after.length, 2);
  assert.ok(after[1]!.sortOrder > after[0]!.sortOrder);
});

test('addReclaimItemForMember: fog SAVES — it is caught downstream, not at the door', async () => {
  // INVERTED 2026-08-16. This used to assert fog was refused. That refusal cost a real member her own sentence
  // ("...that don't feel like they're always in jeopardy" — \bfeel\b), and because the plainer version passed,
  // every time she added detail the rejection got MORE certain. See tests/reclaim-vagueness-gate.test.ts.
  //
  // The Beat engine never could bind a foggy item, and still can't — bindGoalItem filters it. That is the right
  // place for the check: it costs a goal-close, not the member's words.
  const { db, memberId } = await seedMember();
  const r = await addReclaimItemForMember(db, memberId, 'be happier and more confident');
  assert.equal(r.ok, true, 'her words are hers');
  assert.equal((await getReclaimItems(db, memberId)).length, 1, 'and they are on her list');
});

test('addReclaimItemForMember: empty and duplicate are refused', async () => {
  const { db, memberId } = await seedMember();
  assert.equal((await addReclaimItemForMember(db, memberId, '   ')).ok, false);
  await addReclaimItemForMember(db, memberId, 'ride Carter Lake on Saturdays');
  const dup = await addReclaimItemForMember(db, memberId, 'Ride Carter Lake on Saturdays');
  assert.equal(dup.ok, false);
  if (!dup.ok) assert.equal(dup.reason, 'duplicate');
  assert.equal((await getReclaimItems(db, memberId)).length, 1);
});

test('addDoorForMember: maps free text to a canonical Door, additive, no duplicates', async () => {
  const { db, memberId } = await seedMember();
  const r = await addDoorForMember(db, memberId, 'my wife and I were really struggling, the marriage took a hit');
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.added, ['The Marriage']);

  const rows = (await db.query<{ door_slug: string }>('select door_slug from member_door where member_id=$1 order by sort_order', [memberId])).rows;
  assert.deepEqual(rows.map((x) => x.door_slug).sort(), ['body', 'marriage']);

  // adding the same Door again is a no-op ('already')
  const again = await addDoorForMember(db, memberId, 'the marriage strain');
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.reason, 'already');
});

test('addDoorForMember: unmappable text returns nomatch and writes nothing', async () => {
  const { db, memberId } = await seedMember();
  const before = (await db.query<{ n: number }>('select count(*)::int n from member_door where member_id=$1', [memberId])).rows[0]!.n;
  const r = await addDoorForMember(db, memberId, 'asdfghjkl nothing meaningful here');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'nomatch');
  const after = (await db.query<{ n: number }>('select count(*)::int n from member_door where member_id=$1', [memberId])).rows[0]!.n;
  assert.equal(after, before);
});

test('setMemberDoors writes the canonical set — adds new, drops removed, first is primary, never empty', async () => {
  const { db, memberId } = await seedMember(); // seeded with 'body'
  await setMemberDoors(db, memberId, ['full_house', 'career_cliff']);
  assert.deepEqual(await getMemberDoors(db, memberId), ['full_house', 'career_cliff']); // primary first
  const primary = (await db.query<{ door_slug: string }>("select door_slug from member_door where member_id=$1 and is_primary", [memberId])).rows[0]!.door_slug;
  assert.equal(primary, 'full_house');
  // an empty set is refused (≥1 Door contract) — the existing set stands
  await setMemberDoors(db, memberId, []);
  assert.deepEqual(await getMemberDoors(db, memberId), ['full_house', 'career_cliff']);
});

// ============================================================================================================
// §2b revision (Decision L) persistence — the 0043 soft-delete substrate + the correct-pair harvest tell (R5).
// ============================================================================================================

test('softSetMemberDoors soft-removes the old Door (never destroys) and reactivates on return — §2b revision', async () => {
  const { db, memberId } = await seedMember(); // seeded 'body' primary
  await softSetMemberDoors(db, memberId, ['load_bearer']); // correct body → load_bearer
  assert.deepEqual(await getMemberDoors(db, memberId), ['load_bearer'], 'active set is the corrected Door');
  // the old Door is PRESERVED, just soft-removed (removed_at set) — never hard-deleted
  const body = (await db.query<{ removed_at: string | null }>("select removed_at from member_door where member_id=$1 and door_slug='body'", [memberId])).rows[0];
  assert.ok(body, 'the old Door row still exists (recoverable)');
  assert.ok(body!.removed_at, 'it is soft-removed, not deleted');
  const named = (await db.query<{ named_door: string }>('select named_door from member_profile where member_id=$1', [memberId])).rows[0]!.named_door;
  assert.equal(named, 'load_bearer', 'named_door follows the new primary');
  // returning to the old Door reactivates the SAME row (removed_at → null) — no duplicate
  await softSetMemberDoors(db, memberId, ['body']);
  assert.deepEqual(await getMemberDoors(db, memberId), ['body']);
  const n = (await db.query<{ n: number }>("select count(*)::int n from member_door where member_id=$1 and door_slug='body'", [memberId])).rows[0]!.n;
  assert.equal(n, 1, 'reactivated in place — no duplicate row');
});

test('softSetMemberDoors keeps the untouched primary and swaps only the secondary — §2b revision', async () => {
  const { db, memberId } = await seedMember();
  await setMemberDoors(db, memberId, ['grind', 'marriage']); // grind primary, marriage secondary
  await softSetMemberDoors(db, memberId, ['grind', 'load_bearer']); // correct marriage → load_bearer; grind untouched
  assert.deepEqual(await getMemberDoors(db, memberId), ['grind', 'load_bearer']);
  const marriage = (await db.query<{ removed_at: string | null }>("select removed_at from member_door where member_id=$1 and door_slug='marriage'", [memberId])).rows[0];
  assert.ok(marriage!.removed_at, 'the corrected-away Door is soft-removed, not gone');
});

test('emitHarvestMoment carries the re-seeing pair + reconnect surface (§2b R5 correct-pair link)', async () => {
  const { db, memberId } = await seedMember();
  const momentId = await emitHarvestMoment(db, memberId, {
    destinationIntent: 'keeper', keeperType: 'tell', surface: 'reconnect',
    sourceRef: { kind: 'reconnect', ref: 'doors', label: 'Re-seeing · The Marriage → The Load-Bearer' },
    payloadRef: 'The Marriage → The Load-Bearer',
    pair: { fromSlug: 'marriage', toSlug: 'load_bearer' },
  });
  assert.ok(momentId, 'returns the correlation id');
  const row = (await db.query<{ surface: string; kind: string; meta: unknown }>('select surface, kind, meta from member_event where member_id=$1', [memberId])).rows[0]!;
  const meta = (typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta) as { pair?: unknown; keeperType?: string };
  assert.equal(row.kind, 'harvest_moment');
  assert.equal(row.surface, 'reconnect', 'tagged as a reconnect-surface event');
  assert.equal(meta.keeperType, 'tell');
  assert.deepEqual(meta.pair, { fromSlug: 'marriage', toSlug: 'load_bearer' }, 'the from→to correct-pair link rides in meta');
});

test('§2d drift keeper COMMITS a visible Playbook entry (own_words, kept, the member\'s words)', async () => {
  const { db, memberId } = await seedMember();
  const body = 'I stopped riding, stopped seeing friends, stopped feeling at home in my body — each went quiet';
  const momentId = await emitHarvestMoment(db, memberId, {
    destinationIntent: 'keeper', keeperType: 'tell', surface: 'reconnect',
    sourceRef: { kind: 'drift', ref: 'drift', label: 'The drift' }, payloadRef: body,
  });
  await commitKeeper(db, memberId, {
    momentId, keeperType: 'tell', section: 'own_words', body, state: 'kept',
    source: { kind: 'own', ref: 'drift', label: 'The drift' },
  });
  const rows = (await db.query<{ section: string; body: string; state: string; keeper_type: string }>(
    'select section, body, state, keeper_type from playbook_entry where member_id=$1', [memberId])).rows;
  assert.equal(rows.length, 1, 'one Playbook entry is committed');
  assert.equal(rows[0]!.section, 'own_words');
  assert.equal(rows[0]!.state, 'kept', "the bridge says 'I've kept it for you' — so it's kept, not just proposed");
  assert.equal(rows[0]!.keeper_type, 'tell');
  assert.match(rows[0]!.body, /stopped riding/, "the member's own words are preserved verbatim");
});

test('reconcileDoors (no-API fallback) keeps current + adds what the conversation surfaced', async () => {
  const key = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const out = await reconcileDoors('honestly it was the body, and then I got married and had kids', ['body']);
    assert.ok(out.includes('body')); // kept
    assert.ok(out.includes('full_house')); // surfaced from "married + had kids"
  } finally {
    if (key !== undefined) process.env.ANTHROPIC_API_KEY = key;
  }
});
