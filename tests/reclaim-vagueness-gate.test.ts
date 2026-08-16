// A MEMBER'S OWN WORDS ARE NOT REJECTABLE.
//
// Donna, 2026-08-15, live: "Have peace and stability that don't feel like they're always in jeopardy."
// The Companion refused it, repeatedly, and eventually told her "the system keeps rejecting it."
//
// The trigger was one word. isVagueReclaim is a regex matching \bfeel\b — and her phrase is a NEGATION
// ("don't feel like they're in jeopardy") describing an observable absence of conflict, which is precisely what
// she was being asked for. Worse, the plainer version passed and the ELABORATED version failed, so every time
// she added detail the refusal got more certain. The loop could not break.
//
// ── THE DEFECT WAS PLACEMENT, NOT THE PATTERN ─────────────────────────────────────────────────────────────
// isVagueReclaim's own comment: "Catching the worst offenders is enough — a false positive just loses the
// goal-close (still a valid rep)." It was built as a SOFT signal for bindGoalItem, with false positives
// explicitly accepted BECAUSE the cost was small. It was then wired as a HARD REJECT on two write paths, where
// the cost is a member losing her own sentence.
//
// So the fix is not a smarter regex — the next member will phrase it differently. The fix is that the write
// paths stop consulting it at all. Fog is still caught downstream in bindGoalItem, exactly where it was
// designed to be caught, and the item is still SAVED.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { addReclaimItemForMember } from '../lib/member/refine.ts';
import { refineReclaimItemByText, getReclaimItems, addReclaimItems } from '../lib/beats/store.ts';
import { bindGoalItem } from '../lib/beats/serves.ts';
import { isVagueReclaim } from '../lib/beats/category.ts';

async function member(): Promise<{ db: Db; id: string }> {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('D','d@x.test') returning member_id`,
  );
  return { db, id: rows[0]!.member_id };
}

// Her actual sentence.
const DONNA = "Have peace and stability that don't feel like they're always in jeopardy";

test('THE CASE: a member can save her own words, negated "feel" and all', async () => {
  const { db, id } = await member();
  const res = await addReclaimItemForMember(db, id, DONNA);
  assert.equal(res.ok, true, 'her sentence is hers — it saves');
  const items = await getReclaimItems(db, id);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.text, DONNA, 'stored verbatim, not sharpened on her behalf');
});

test('elaboration must never make saving HARDER — the loop that trapped her', async () => {
  // The plain version always passed; adding detail is what broke it. A member being coached toward specificity
  // and then punished for supplying it is the exact shape that made this unescapable.
  const { db, id } = await member();
  const plain = await addReclaimItemForMember(db, id, 'Have peace and stability');
  const detailed = await addReclaimItemForMember(db, id, DONNA);
  assert.equal(plain.ok, true);
  assert.equal(detailed.ok, true, 'the MORE specific version must not be the one that fails');
});

test('rewording is not a hostage either', async () => {
  const { db, id } = await member();
  await addReclaimItems(db, id, [{ text: 'Have peace and stability', category: 'outlook' }]);
  const res = await refineReclaimItemByText(db, id, 'have peace and stability', DONNA);
  assert.equal(res.ok, true, 'she can reword her own item into her own fuller sentence');
  assert.equal((await getReclaimItems(db, id))[0]!.text, DONNA);
});

test('fog is still caught — downstream, where it was designed to be caught', async () => {
  // The safety net is not weakened, it is restored to its intended place. A genuinely foggy item saves, and
  // then simply never binds to a goal Beat (it falls through to a "did you do it?" rep until sharpened).
  const { db, id } = await member();
  await addReclaimItemForMember(db, id, 'feel better about myself');
  const items = await getReclaimItems(db, id);
  assert.equal(items.length, 1, 'saved — the member is not blocked');
  assert.equal(isVagueReclaim(items[0]!.text), true, 'still recognised as fog');
  const bound = bindGoalItem(
    { close_type: 'goal', serves: ['self'] } as never,
    items as never,
  );
  assert.equal(bound, null, 'and no goal-close binds to it — the real safety net, unchanged');
});

test('the genuinely empty case is still refused — this is not a free-for-all', async () => {
  const { db, id } = await member();
  assert.equal((await addReclaimItemForMember(db, id, '   ')).ok, false, 'nothing is not a goal');
});

test('duplicates are still folded — that guard was never the problem', async () => {
  const { db, id } = await member();
  await addReclaimItemForMember(db, id, DONNA);
  const again = await addReclaimItemForMember(db, id, DONNA);
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'duplicate');
});
