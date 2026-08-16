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
// paths stop consulting it at all.
//
// ── AND THEN THE SECOND HALF, LATER THE SAME DAY ───────────────────────────────────────────────────────────
// The morning's fix claimed fog was "still caught downstream in bindGoalItem, exactly where it was designed to
// be caught." That was the surviving half of the same wrong idea, and it survived because nothing failed
// loudly: the item saved, and then silently never bound to a goal close.
//
// Greg's RECLAIM Gated Assets V4 (substep 2.3, "Refine the list") settled it. His worked examples of a WELL-
// refined Reclaim item — the OUTPUT the program is designed to produce — are:
//     "feel physically capable and steady again"
//     "feel more connected to people I care about"
// Both match the fog regex. The filter was refusing to serve precisely the goals the curriculum teaches members
// to write. And the premise was wrong as well as the placement: "did this move you toward feeling better about
// yourself?" is not unanswerable — it is close kin to the questions C1 is built out of.
//
// bindGoalItem no longer consults isVagueReclaim. The function survives (it shares a module with inferCategory,
// and may yet be a useful soft signal somewhere honest), but nothing gates a member's own words on it.

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

test('an inner-state goal BINDS — the second half of the same fix', async () => {
  // Reversed 2026-08-16. This used to assert `bound === null`, on the theory that a fog close is unanswerable.
  // It isn't, and the filter was silently withholding the goal close from her most personal item.
  const { db, id } = await member();
  await addReclaimItemForMember(db, id, 'feel better about myself');
  const items = await getReclaimItems(db, id);
  assert.equal(items.length, 1, 'saved — the member is not blocked');
  assert.equal(isVagueReclaim(items[0]!.text), true, 'the regex still matches it — that is no longer decisive');
  const bound = bindGoalItem({ close_type: 'goal', serves: ['self'] } as never, items as never);
  assert.ok(bound, 'and it BINDS: "did that move you toward feeling better about yourself?" is answerable');
  assert.equal(bound!.text, 'feel better about myself');
});

test("GREG'S OWN EXEMPLAR of a well-refined item must be servable", async () => {
  // RECLAIM Gated Assets V4, substep 2.3 — his model of what refinement should PRODUCE. If the engine cannot
  // serve these, the curriculum teaches members to write goals the product then declines to work toward.
  const GREG_REFINED = ['feel physically capable and steady again', 'feel more connected to people I care about'];
  for (const text of GREG_REFINED) {
    const { db, id } = await member();
    await addReclaimItemForMember(db, id, text);
    const items = await getReclaimItems(db, id);
    assert.equal(isVagueReclaim(text), true, `precondition: "${text}" trips the old fog regex`);
    const bound = bindGoalItem({ close_type: 'goal', serves: ['any'] } as never, items as never);
    assert.ok(bound, `Greg's refined exemplar must bind to a goal Beat: "${text}"`);
  }
});

test("Donna's own sentence binds to a goal Beat", async () => {
  // The whole point, end to end: her words save, AND the engine will work toward them.
  const { db, id } = await member();
  await addReclaimItems(db, id, [{ text: DONNA, category: 'outlook' }]);
  const items = await getReclaimItems(db, id);
  const bound = bindGoalItem({ close_type: 'goal', serves: ['outlook'] } as never, items as never);
  assert.ok(bound, 'her item is servable, not just storable');
  assert.equal(bound!.text, DONNA, 'and it is still her sentence, verbatim');
});

test("'life' items still never bind — that exclusion is unrelated and stands", async () => {
  // Guard against over-correcting: the fix removed the FOG filter, not the life-category rule. Life items are
  // tracked and witnessed, never coached (docs/reclaim-anygoal.md), and they advance via the companion mark.
  const { db, id } = await member();
  await addReclaimItems(db, id, [{ text: 'a creative role that pays the bills', category: 'life' }]);
  const items = await getReclaimItems(db, id);
  const bound = bindGoalItem({ close_type: 'goal', serves: ['any'] } as never, items as never);
  assert.equal(bound, null, 'life items are still not coached by a goal Beat');
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
