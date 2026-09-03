// B2 RUNS GREG'S FIVE STAGES — AND ITS SHAPE IS NOT B1'S.
//
// B2.md:441: engagement → assessment support → evocation → didactic informing → consolidation.
//
// THE DIFFERENCE FROM B1 IS THE INTERESTING PART, and it is the thing a later reader is most likely to "fix".
// B1 elicits BEFORE each half of its instrument; B2 puts the whole assessment second and the drawing-out AFTER
// it. That is not an inconsistency in Greg's specs — it follows from what each measures. A member can say why
// they want to move before anyone asks; they have no vocabulary for twelve self-management skills until they
// have been walked through them. Asking "which of these are already yours" first would be supplying the answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebuildB2Opening, applyRebuildB2Turn, REBUILD_B2_ARC } from '../lib/agent/rebuild.ts';
import { SKILLS_ITEM_COUNT } from '../lib/rebuild/skills-instrument.ts';
import type { ConvState, Turn } from '../lib/agent/onboarding.ts';

const SEP = String.fromCharCode(30);
const say = (t: Turn, msg: string, modelText = 'Mm.') =>
  applyRebuildB2Turn(t.state as ConvState, [], msg, { text: modelText });

function walk(): Turn[] {
  const turns: Turn[] = [rebuildB2Opening()];
  let t = turns[0]!;
  const push = (x: Turn) => { turns.push(x); return x; };
  t = push(say(t, 'I kept a running streak for two years once.'));
  for (let i = 0; i < SKILLS_ITEM_COUNT; i++) t = push(say(t, '3'));
  // evocation — after the instrument, floor of 2
  t = push(say(t, 'The planning ones felt true about me.'));
  t = push(say(t, 'I wanted to rate the slip one higher than I could.'));
  // didactic — two points
  t = push(say(t, 'More learnable than I thought, yes.'));
  t = push(say(t, 'Getting back on after a slip.'));
  // consolidation
  t = push(say(t, 'Planning ahead, probably.'));
  t = push(say(t, 'Getting back on after a slip.'));
  return turns;
}

test('B2 walks Greg’s five stages, in his order', () => {
  assert.deepEqual(REBUILD_B2_ARC.stageOrder, ['skills-open', 'skills', 'skills-evoke', 'skills-teach', 'skills-close']);
  const stages = walk().map((t) => (t.state as ConvState).stage);
  for (const s of ['skills-open', 'skills', 'skills-evoke', 'skills-teach', 'skills-close'])
    assert.ok(stages.includes(s) || s === 'skills-close', `${s} never ran`);
  assert.equal(stages.at(-1), 'complete', 'and the Session closes');
});

test('the assessment comes BEFORE the evocation — B2’s order, not B1’s', () => {
  // The claim worth pinning, because it looks like an inconsistency with B1 and is not.
  const turns = walk();
  const firstItem = turns.findIndex((t) => (t.state as ConvState).stage === 'skills');
  const firstEvoke = turns.findIndex((t) => (t.state as ConvState).stage === 'skills-evoke');
  assert.ok(firstItem >= 0 && firstEvoke > firstItem, 'they rate the skills, THEN say what they noticed');
});

test('all 24 items are administered, and the profile is read back only at the close', () => {
  const turns = walk();
  const final = turns.at(-1)!;
  assert.equal(final.complete, true);
  assert.equal((final.state as ConvState).administeredResponses?.length, SKILLS_ITEM_COUNT, 'all 24 captured');
  // THE PROFILE MOVED TO THE CLOSE ON PURPOSE. It used to be read out the instant the 24th answer landed, which
  // would now pre-empt the evocation beat — the member would be told what their answers mean and then asked what
  // they noticed. Nothing before the close may name a strength or a growth edge.
  const beforeClose = turns.slice(0, -1).map((t) => t.reply).join('\n');
  assert.doesNotMatch(beforeClose, /strongest looks like|room to grow/i, 'the profile was read before it was earned');
  assert.match(final.reply, /strongest looks like|room to grow/i, 'and it does land at the close');
});

test('Greg’s four permitted points all reach the member, in his approved phrasing', () => {
  const all = walk().map((t) => t.reply).join('\n');
  assert.match(all, /aren't personality traits\. They're skills\./i, 'B2-56 · skills, not traits (verbatim)');
  assert.match(all, /isn't a flaw\. It's just information/i, 'B2-58 · weakness is information (verbatim)');
  assert.match(all, /Predisposing, Enabling and Reinforcing/i, 'B2-57 · the three-factor framework');
  assert.match(all, /bridge between wanting something and doing it/i, 'B2-60 · the CFW bridge, into B3');
});

test('none of Greg’s THREE FORBIDDEN formulations can be produced by the authored copy', () => {
  // B2-59. All three are one move — turning a self-rating into a verdict about the person — and B2 is the Session
  // most exposed to it, because a member has just rated themselves low on several things and is waiting to be
  // told what that means about them. The model is instructed against these; the AUTHORED copy must not contain
  // them either, which is the half a prompt rule cannot enforce.
  const all = walk().map((t) => t.reply).join('\n');
  assert.doesNotMatch(all, /you need to improve your \w+ skills/i, 'forbidden · prescribing a skill group');
  assert.doesNotMatch(all, /scores? (are|is) low, so you'?re not ready/i, 'forbidden · diagnosing readiness');
  assert.doesNotMatch(all, /separates people who succeed/i, 'forbidden · a rating as a claim about character');
  // And the shape behind all three: no category total, percentage or score is ever spoken.
  assert.doesNotMatch(all, /\d+\s*%|\/\s*48\b/, 'no scores or totals are ever said out loud');
});

test('a didactic point never arrives two-in-a-breath, and always hands the floor back', () => {
  for (const t of walk()) {
    if (!/personality traits|isn't a flaw/i.test(t.reply)) continue;
    // COUNTS POINTS, NOT BUBBLES — see the note on the same test in b1-five-stages. The teaching turn now receives
    // her answer before teaching (Donna, 2026-09-03, on THIS Session: "left her hanging"), so a receipt bubble is
    // legitimate. Counting points is the tighter check: two in one turn fails either way.
    const bubbles = t.reply.split(SEP);
    const points = bubbles.filter((x) => /personality traits|isn't a flaw/i.test(x));
    assert.equal(points.length, 1, 'exactly one didactic point per turn — two is a lecture');
    assert.match(bubbles[bubbles.length - 1]!, /\?$/, 'B2-53 · every didactic turn ends with a question');
    assert.ok(bubbles.length <= 3, 'at most: her receipt, the point, the hand-back');
  }
});

test('the model never speaks over an administered item', () => {
  let t = say(rebuildB2Opening(), 'A running streak, once.');
  const item = say(t, '3', 'I SHOULD NOT APPEAR — the model was called on an administered turn.');
  assert.doesNotMatch(item.reply, /I SHOULD NOT APPEAR/, 'model text leaked into an instrument turn');
});

test('the teaching beat can be declined, and the close still lands', () => {
  let t = say(rebuildB2Opening(), 'A running streak, once.');
  for (let i = 0; i < SKILLS_ITEM_COUNT; i++) t = say(t, '3');
  t = say(t, 'The planning ones felt true.');
  t = say(t, 'I wanted to rate the slip one higher.');
  assert.equal((t.state as ConvState).stage, 'skills-teach');
  t = say(t, 'Makes sense.'); // first point delivered
  t = say(t, "no thanks, let's move on");
  assert.equal((t.state as ConvState).stage, 'skills-close', 'declining ends the teaching there and then');
  const closed = say(t, 'Getting back on after a slip.');
  assert.equal(closed.complete, true, 'and the Session still closes properly');
  assert.match(closed.reply, /strongest looks like|room to grow/i, 'with the profile intact');
});
