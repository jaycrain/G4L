// B1 RUNS GREG'S FIVE STAGES, AND THE INSTRUMENT RUNS INSIDE THEM.
//
// B1.md:257 has declared the sequence since it was written — engagement → activity elicitation → eating
// elicitation → didactic informing → consolidation — and we shipped one twelve-item instrument with a paragraph
// on top of it. Jay, 2026-08-28: "If the Session is leading with an assessment, something's missing."
//
// The load-bearing reading, and the one worth a test: the twelve items are NOT a sixth stage. Greg names
// elicitation and never names the instrument, because the items run INSIDE the elicitation beats — six activity
// items with the activity talk, six eating items with the eating talk. One motion: say it, then rate it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebuildB1Opening, applyRebuildB1Turn, REBUILD_B1_ARC } from '../lib/agent/rebuild.ts';
import { WHY_ITEM_COUNT, WHY_DOMAIN_SPLIT, WHY_ITEMS } from '../lib/rebuild/why-instrument.ts';
import type { ConvState, Turn } from '../lib/agent/onboarding.ts';

const SEP = String.fromCharCode(30);
const say = (t: Turn, msg: string, modelText = '') =>
  applyRebuildB1Turn(t.state as ConvState, [], msg, { text: modelText });

/** Walk the whole Session, collecting every turn. Real prose for the beats, 5s for the items. */
function walk(): Turn[] {
  const turns: Turn[] = [rebuildB1Opening()];
  const push = (t: Turn) => { turns.push(t); return t; };
  let t = turns[0]!;
  t = push(say(t, 'That I let it go and it is too late now.', 'That is a heavy one to carry.'));
  // activity elicitation — floor of 2 substantive turns
  t = push(say(t, 'I want to be able to keep up with my kids.', 'Keeping up with them.'));
  t = push(say(t, 'And honestly I miss feeling strong.', 'Missing strong.'));
  for (let i = 0; i < WHY_DOMAIN_SPLIT; i++) t = push(say(t, '5'));
  // eating elicitation — floor of 1
  t = push(say(t, 'Eating is more about not feeling sluggish.', 'Not sluggish.'));
  for (let i = 0; i < WHY_DOMAIN_SPLIT; i++) t = push(say(t, '5'));
  // didactic — two points, one per turn
  t = push(say(t, 'The kids one, definitely.', 'That one.'));
  t = push(say(t, 'Yeah, with running years ago.', 'It has.'));
  // consolidation — the teaching beat hands off with the consolidation question, they answer it, it closes
  t = push(say(t, 'Being strong enough to say yes to things.', 'Saying yes.'));
  t = push(say(t, 'That I can still do hard things.', 'Still doing hard things.'));
  return turns;
}

test('B1 walks all five of Greg’s stages, in his order', () => {
  const stages = walk().map((t) => (t.state as ConvState).stage);
  // The five stages, by the beat each one is. why-activity / why-eating are the instrument halves living inside
  // the two elicitation beats, which is the whole design claim.
  for (const s of ['why-open', 'why-activity-talk', 'why-activity', 'why-eating-talk', 'why-eating', 'why-teach', 'why-close'])
    assert.ok(REBUILD_B1_ARC.stageOrder.includes(s), `${s} is not in the arc`);
  assert.ok(stages.includes('why-activity-talk'), 'the activity elicitation ran');
  assert.ok(stages.includes('why-eating-talk'), 'the eating elicitation ran');
  assert.ok(stages.includes('why-teach'), 'the didactic beat ran');
  assert.equal(stages[stages.length - 1], 'complete', 'and the Session closes');
});

test('all twelve items are still administered, and none is lost at the split', () => {
  // THE RISK THE SPLIT INTRODUCES. `itemCount` is compared against a SHARED response bag, so the second half's
  // target is CUMULATIVE (12, not 6). Getting that wrong ends the Session six answers early with half a profile —
  // silently, because the close does not show a number (RB-1).
  const final = walk().at(-1)!;
  assert.equal(final.complete, true);
  assert.equal((final.state as ConvState).administeredResponses?.length, WHY_ITEM_COUNT, 'all 12 captured');
});

test('the member is told "of 12" in BOTH halves, never "of 6"', () => {
  // displayTotal exists for exactly this: itemCount answers "is this stage done", the member-facing count must
  // always be the whole instrument's length or the eating half announces itself as a fresh six-question form.
  for (const t of walk()) {
    if (!t.expects) continue;
    assert.equal((t.expects as { total?: number }).total, WHY_ITEM_COUNT, 'the count is the instrument, not the stage');
  }
});

test('elicitation comes BEFORE its items, in both domains', () => {
  const turns = walk();
  const stageAt = (i: number) => (turns[i]!.state as ConvState).stage;
  const firstActivityItem = turns.findIndex((_, i) => stageAt(i) === 'why-activity');
  const firstActivityTalk = turns.findIndex((_, i) => stageAt(i) === 'why-activity-talk');
  const firstEatingItem = turns.findIndex((_, i) => stageAt(i) === 'why-eating');
  const firstEatingTalk = turns.findIndex((_, i) => stageAt(i) === 'why-eating-talk');
  assert.ok(firstActivityTalk < firstActivityItem, 'they say it before they rate it (activity)');
  assert.ok(firstEatingTalk < firstEatingItem, 'they say it before they rate it (eating)');
});

test('the elicitation beat holds for its floor, then hands over regardless', () => {
  // A FLOOR, NOT A GATE. It must not be escapable by one word, and must not be a beat a member can be stuck in.
  let t = say(rebuildB1Opening(), 'Something.', 'Mm.');
  assert.equal((t.state as ConvState).stage, 'why-activity-talk');
  t = say(t, 'I want to keep up with my kids.', 'Keeping up.');
  assert.equal((t.state as ConvState).stage, 'why-activity-talk', 'one answer does not open the instrument');
  t = say(t, 'And I miss feeling strong.', 'Strong.');
  assert.equal((t.state as ConvState).stage, 'why-activity', 'the second does');
});

test('assent is not material — it cannot walk a member past the elicitation', () => {
  // "ok", "sure" are turns, not reasons. Counting them would let the beat be skipped by saying nothing, which is
  // the failure the floor exists to prevent.
  // Bounded at two, deliberately: the kernel's own runaway backstop force-advances after three consecutive
  // no-progress turns, and that liveness guarantee outranks this floor — a member must never be trappable in a
  // beat. What this asserts is the part the floor owns: assent does not COUNT as one of the two reasons.
  let t = say(rebuildB1Opening(), 'Something.', 'Mm.');
  for (const filler of ['ok', 'sure']) t = say(t, filler, 'Take your time.');
  assert.equal((t.state as ConvState).stage, 'why-activity-talk', 'still gathering — nothing was said yet');
  t = say(t, 'I want to keep up with my kids.', 'Mm.');
  assert.equal((t.state as ConvState).stage, 'why-activity-talk', 'that was the FIRST real reason, not the third turn');
});

test('the model never speaks over an administered item', () => {
  // THE WALL. A generated sentence beside a validated stem is the thing administered mode exists to prevent, and
  // adding conversational stages to this arc is exactly how it would get breached.
  let t = say(rebuildB1Opening(), 'Something.', 'Mm.');
  t = say(t, 'To keep up with my kids.', 'Mm.');
  t = say(t, 'And to feel strong.', 'Mm.');
  const item = say(t, '5', 'I SHOULD NOT APPEAR — the model was called on an administered turn.');
  assert.doesNotMatch(item.reply, /I SHOULD NOT APPEAR/, 'model text leaked into an instrument turn');
  assert.ok(item.reply.includes(WHY_ITEMS[1]!.stem), 'the next item, verbatim and alone');
});

test('Greg’s four permitted didactic points all reach the member, each at its own seam', () => {
  const all = walk().map((t) => t.reply).join('\n');
  assert.match(all, /quality to it/i, 'B1-12 · amount vs quality (the teaching beat)');
  assert.match(all, /starting point/i, 'B1-13 · the shift principle (the teaching beat)');
  assert.match(all, /different reasons for eating than for moving/i, 'B1-15 · dual-domain (at the crossing)');
  assert.match(all, /process/i, 'B1-14 · process-product (at consolidation)');
});

test('a didactic point never arrives two-in-a-breath, and always hands the floor back', () => {
  // Greg's rule and ours agree: at most one per turn, ≤3 sentences, ending on a question. A teaching beat that
  // stacks points is a lecture, which is the one thing didactic latitude must not become.
  for (const t of walk()) {
    if (!/quality to it|A lot of people find/i.test(t.reply)) continue;
    // ASSERTS THE RULE, NOT A BUBBLE COUNT. This required exactly two bubbles, which was a proxy for "one point,
    // then the hand-back" — and it broke on 2026-09-03 when the teaching turn started RECEIVING her answer before
    // teaching (Donna: "left her hanging"; the point used to discard what she had just said). A receipt does not
    // stack a point, so the count was measuring the wrong thing.
    //
    // Changed the assertion because the behaviour changed, and it must not be a weakening: counting POINTS is
    // strictly tighter than counting bubbles — two points in one turn now fails whether or not a receipt is there.
    const bubbles = t.reply.split(SEP);
    const points = bubbles.filter((x) => /quality to it|A lot of people find/i.test(x));
    assert.equal(points.length, 1, 'exactly one didactic point per turn — two is a lecture');
    assert.match(bubbles[bubbles.length - 1]!, /\?$/, 'the beat ends by returning the turn to them');
    assert.ok(points[0]!.split(/[.!?]\s/).length <= 3, 'a point is at most three sentences');
    assert.ok(bubbles.length <= 3, 'at most: her receipt, the point, the hand-back');
  }
});

test('the teaching beat can be declined, and stops asking', () => {
  // Permission is real or it is decoration. "No thanks" must end the teaching immediately, not after the ledger
  // runs out.
  let t = say(rebuildB1Opening(), 'Something.', 'Mm.');
  t = say(t, 'To keep up with my kids.', 'Mm.');
  t = say(t, 'And to feel strong.', 'Mm.');
  for (let i = 0; i < WHY_DOMAIN_SPLIT; i++) t = say(t, '5');
  t = say(t, 'Not feeling sluggish.', 'Mm.');
  for (let i = 0; i < WHY_DOMAIN_SPLIT; i++) t = say(t, '5');
  assert.equal((t.state as ConvState).stage, 'why-teach', 'the teaching beat opened');
  const first = say(t, 'The kids one.', 'That one.');
  const declined = say(first, "no thanks, let's move on", 'Of course.');
  assert.equal((declined.state as ConvState).stage, 'why-close', 'declining ends the teaching there and then');
  assert.doesNotMatch(declined.reply, /A lot of people find/i, 'and does not deliver the point anyway');
});

test('the teaching beat is bounded even if the member never declines', () => {
  // maxShared is the ledger's job. Without it an engaged member gets every point we own, which is the same
  // failure as ignoring a decline, arriving politely.
  let t = say(rebuildB1Opening(), 'Something.', 'Mm.');
  t = say(t, 'To keep up with my kids.', 'Mm.');
  t = say(t, 'And to feel strong.', 'Mm.');
  for (let i = 0; i < WHY_DOMAIN_SPLIT; i++) t = say(t, '5');
  t = say(t, 'Not feeling sluggish.', 'Mm.');
  for (let i = 0; i < WHY_DOMAIN_SPLIT; i++) t = say(t, '5');
  for (let i = 0; i < 6; i++) t = say(t, 'That is really interesting, tell me more about that.', 'Mm.');
  // Past the teaching beat is the assertion — by turn six an engaged member has been through consolidation too,
  // so pinning 'why-close' exactly would be pinning the walk's length rather than the bound.
  assert.notEqual((t.state as ConvState).stage, 'why-teach', 'it moved on rather than teaching forever');
});

test('consolidation closes on THEIR reason, not on a number', () => {
  // RB-1: the SDT profile is stored and never displayed. The close must still land on something personal, which
  // is what the consolidation question is for.
  const final = walk().at(-1)!;
  assert.match(final.reply, /starting why/i, 'the authored close');
  assert.doesNotMatch(final.reply, /\/\s*7|\bscore\b|\b\d+\s*out of\b/i, 'no number, no score');
});
