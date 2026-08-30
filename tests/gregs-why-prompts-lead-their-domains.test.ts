// THE QUESTION THE TWELVE STATEMENTS ANSWER.
//
// Greg's B1 instrument asks two domain questions, each with six candidate reasons beneath it:
//   "Why do you want to be physically active regularly?"  → five "I want to be physically active because…" items
//                                                            plus the amotivation item ("I do not really see why…")
//   "Why do you want to eat healthier?"                   → the same shape for eating
//
// BOTH PROMPTS WERE DROPPED on 2026-07-27 in a walk-feedback batch — the comment left behind named only the
// activity one — leaving members to rate twelve "because" statements with the question taken away. The constant
// then sat exported and unused for a month, still describing itself as "shown once as the header before each
// domain's six items". Found by scripts/unrun-rules.mjs.
//
// Restored 2026-08-30 on Jay's ruling: "Donna shouldn't be cutting in Greg's domain." A framing prompt is part of
// the instrument's design, not copy to trim on a walk note. They are NOT redundant with B1_OPEN, which frames the
// exercise and states the scale but never asks the question. [[dont-relax-the-experts-instrument]]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebuildB1Opening, applyRebuildB1Turn } from '../lib/agent/rebuild.ts';
import { WHY_ITEMS, WHY_PROMPTS, WHY_DOMAIN_SPLIT } from '../lib/rebuild/why-instrument.ts';
import type { ConvState, Turn } from '../lib/agent/onboarding.ts';

const say = (t: Turn, msg: string, modelText = '') =>
  applyRebuildB1Turn(t.state as ConvState, [], msg, { text: modelText } as never);

/** Walk to the first item of each domain, collecting what the member is actually shown. */
function deliveries(): { activity: string[]; eating: string[] } {
  let t = rebuildB1Opening();
  const activity: string[] = [];
  const eating: string[] = [];
  t = say(t, 'That I let it go and it is too late now.', 'That is a heavy one.');
  t = say(t, 'I want to keep up with my kids.', 'Keeping up.');
  t = say(t, 'And I miss feeling strong.', 'Missing strong.');
  for (let i = 0; i < WHY_DOMAIN_SPLIT; i++) { activity.push(t.reply); t = say(t, '5'); }
  t = say(t, 'Eating is about not feeling sluggish.', 'Not sluggish.');
  for (let i = 0; i < WHY_DOMAIN_SPLIT; i++) { eating.push(t.reply); t = say(t, '5'); }
  return { activity, eating };
}

test("each domain opens on Greg's question, with its first item under it", () => {
  const { activity, eating } = deliveries();
  assert.ok(activity[0]!.includes(WHY_PROMPTS.activity), 'the activity half asks its question');
  assert.ok(activity[0]!.includes(WHY_ITEMS[0]!.stem), 'and carries the first item');
  assert.ok(eating[0]!.includes(WHY_PROMPTS.diet), 'the eating half asks its question');
  assert.ok(eating[0]!.includes(WHY_ITEMS[WHY_DOMAIN_SPLIT]!.stem), 'and carries its first item');
});

test('it leads the domain — it is a header, not a preamble on all twelve', () => {
  // Repeating it under every item would make the instrument unreadable, and is how a "restore" goes wrong.
  const { activity, eating } = deliveries();
  for (const [n, text] of activity.slice(1).entries())
    assert.ok(!text.includes(WHY_PROMPTS.activity), `activity item ${n + 1} carries no framing`);
  for (const [n, text] of eating.slice(1).entries())
    assert.ok(!text.includes(WHY_PROMPTS.diet), `eating item ${n + 1} carries no framing`);
});

test('the eating half keeps its transition AND the question — not one or the other', () => {
  // The 7/27 cut left the transition and removed the prompt, which is how it read as intact.
  const { eating } = deliveries();
  assert.match(eating[0]!, /now the other half of it/i, 'the domain transition survives');
  assert.ok(eating[0]!.includes(WHY_PROMPTS.diet), 'and the question is back beside it');
});

test('the items really are answers to the question — five reasons plus the amotivation item', () => {
  // If this stops holding, the framing question is the wrong one for these items. Items 5 and 11 are the SDT
  // amotivation items and are deliberately counter-framed ("I do not really see why…"), so they are excluded.
  const because = WHY_ITEMS.filter((i) => /^I want to (be physically active|eat healthier) because/i.test(i.stem));
  assert.equal(because.length, 10, 'five per domain');
  const amotivation = WHY_ITEMS.filter((i) => i.facet === 'amotivation');
  assert.equal(amotivation.length, 2, 'one per domain, counter-framed by design');
});
