import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebuildB2Opening, applyRebuildB2Turn } from '../lib/agent/rebuild.ts';
import {
  scoreSkills,
  skillHighlights,
  skillResponsesMap,
  SKILL_ITEMS,
  SKILLS_ITEM_COUNT,
  SKILLS_DOMAIN_SPLIT,
} from '../lib/rebuild/skills-instrument.ts';
import { practicePrompt } from '../lib/practice/store.ts';

// B2 · Strengths & Weaknesses — the administered 24-item self-management arc (12 skills × activity/diet, 1–4), the
// scoring (per-domain %, per-skill, meta-categories), the plain-language close, and the noticing-week nudge.

test('B2 arc · warm frame → movement pass → diet transition at 12 → plain-language close (no numbers)', () => {
  let t = rebuildB2Opening();
  assert.equal(t.state.stage, 'skills');
  assert.match(t.reply, /take stock of your current state/i, 'the warm frame');
  assert.match(t.reply, /1-strongly disagree to 4-strongly agree/i, 'the 1–4 scale');
  assert.ok(t.reply.includes(SKILL_ITEMS[0]!.stem), 'item 0 verbatim');

  for (let i = 0; i < SKILLS_ITEM_COUNT; i++) {
    assert.equal(t.state.stage, 'skills', `administering at item ${i}`);
    if (i === SKILLS_DOMAIN_SPLIT) assert.match(t.reply, /Same skills now, for eating/i, 'diet transition at 12');
    t = applyRebuildB2Turn(t.state, [], '3', { text: '' } as never);
  }
  assert.equal(t.complete, true, 'after the 24th, B2 completes');
  assert.equal((t.state.administeredResponses ?? []).length, 24, 'all 24 captured');
  assert.match(t.reply, /strongest looks like|room to grow/i, 'reflects strongest + growth edge');
  assert.doesNotMatch(t.reply, /\d+\s*%|\/\s*48|\bscore\b/i, 'no numbers at the close (plain language)');
});

test('B2 arc · out-of-scale (0 or 5) is re-prompted on the 1–4 scale, not recorded', () => {
  const t = rebuildB2Opening();
  const five = applyRebuildB2Turn(t.state, [], '5', { text: '' } as never);
  assert.equal((five.state.administeredResponses ?? []).length, 0, '5 is off a 1–4 scale — not recorded');
  assert.match(five.reply, /1 to 4/i, 're-prompts');
  const good = applyRebuildB2Turn(t.state, [], '4', { text: '' } as never);
  assert.equal((good.state.administeredResponses ?? []).length, 1, '4 is valid on 1–4');
});

test('scoreSkills · per-domain sum/%, per-skill mean, and the 3 meta-categories', () => {
  // activity all 4s (48/48 = 100%), diet all 2s (24/48 = 50%).
  const responses = [...Array(12).fill(4), ...Array(12).fill(2)];
  const s = scoreSkills(responses);
  assert.equal(s.activity.sum, 48);
  assert.equal(s.activity.pct, 100);
  assert.equal(s.diet.sum, 24);
  assert.equal(s.diet.pct, 50);
  assert.equal(s.perSkill.length, 12, 'a mean per skill');
  assert.equal(s.perSkill[0]!.activity, 4);
  assert.equal(s.perSkill[0]!.diet, 2);
  assert.equal(s.perSkill[0]!.mean, 3, 'mean(4,2)');
  // meta: predisposing = skills 6,7,12 → 3 skills × 2 domains = 6 items; each activity=4, diet=2 → sum 18, max 24.
  assert.equal(s.meta.predisposing.max, 24);
  assert.equal(s.meta.predisposing.sum, 18);
  assert.equal(s.meta.predisposing.pct, 75);
  assert.equal(s.meta.enabling.max, 48, 'enabling = 6 skills × 2 = 12 items × 4');
  assert.equal(s.meta.reinforcing.max, 24, 'reinforcing = 3 skills × 2 = 6 items');
});

test('skillHighlights · names the strongest + growth-edge skill by two-domain mean', () => {
  // make skill 3 (goal setting) the strongest and skill 10 (relapse prevention) the weakest.
  const r = Array(24).fill(3);
  const iPA3 = SKILL_ITEMS.findIndex((it) => it.code === 'B2-PA3');
  const iDI3 = SKILL_ITEMS.findIndex((it) => it.code === 'B2-DI3');
  const iPA10 = SKILL_ITEMS.findIndex((it) => it.code === 'B2-PA10');
  const iDI10 = SKILL_ITEMS.findIndex((it) => it.code === 'B2-DI10');
  r[iPA3] = 4; r[iDI3] = 4; r[iPA10] = 1; r[iDI10] = 1;
  const hl = skillHighlights(scoreSkills(r));
  assert.equal(hl.strongest, 'Goal setting');
  assert.equal(hl.growthEdge, 'Relapse prevention');
});

test('scoreSkills · rejects a wrong response count (guards the persist path)', () => {
  assert.throws(() => scoreSkills(Array(23).fill(3)), /expects 24/);
});

test('skillResponsesMap · keys by item code, 24 entries', () => {
  const m = skillResponsesMap(Array.from({ length: 24 }, (_, i) => (i % 4) + 1));
  assert.equal(Object.keys(m).length, 24);
  assert.equal(m['B2-PA1'], 1);
  assert.equal(m['B2-DI12'], SKILL_ITEMS[23]!.code === 'B2-DI12' ? ((23 % 4) + 1) : m['B2-DI12']);
});

test('practicePrompt · b2_noticing nudge is observational, not a gate', () => {
  const nudge = practicePrompt('b2_noticing', {});
  assert.match(nudge!, /notice/i);
  assert.doesNotMatch(nudge!, /missed|failed|must/i, 'productive-default, non-judgmental');
});
