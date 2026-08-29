import { test } from 'node:test';
const SEP = String.fromCharCode(30);
import { SKILL_LABEL as SKILL_LABEL_CHECK } from '../lib/rebuild/skills-instrument.ts'; // BEAT_SEP — the frame arrives as several bubbles
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

// PAST THE ENGAGEMENT DOORWAY (2026-08-28). Jay, walking this Session: "This Session can't just start with an
// assessment." It no longer does — Greg's Stage 1 (B2.md:448) opens it and the 24 items arrive on the next turn.
// The doorway is covered in tests/no-session-opens-on-an-assessment.test.ts.
const pastDoorway = () =>
  applyRebuildB2Turn(rebuildB2Opening().state, [], 'I kept a running streak going for two years once.', { text: '' } as never);

test('B2 arc · warm frame → movement pass → diet transition at 12 → plain-language close (no numbers)', () => {
  assert.match(rebuildB2Opening().reply, /made stick once/i, 'the doorway asks for a skill they already have');

  let t = pastDoorway();
  assert.equal(t.state.stage, 'skills');
  // THE FRAME BY ITS JOB, NOT ITS WORDING. This pinned the exact sentence ("take stock of your current state") and
  // so failed the moment the set-up was rewritten from Greg's own member-shown introduction (Donna, 2026-08-23:
  // Rebuild "doesn't have any set-up"). A test that breaks when copy IMPROVES teaches people to edit the test.
  // What must survive is what the frame is FOR — the four things a member needs before rating 24 items about
  // herself.
  const frame = t.reply.split(SEP).slice(0, -1).join(' '); // everything before the first item
  assert.ok(frame.split(SEP).length >= 1 && frame.length > 200, 'there is a real set-up, not one line');
  assert.match(frame, /practice|get better/i, 'a skill is practised, not a fixed trait');
  assert.match(frame, /twelve|12/i, 'the scope — she can see the end of the form');
  assert.match(frame, /1 \(strongly disagree\)|1-strongly disagree/i, 'the 1–4 scale');
  assert.match(frame, /not.{0,20}graded|honestly/i, 'honest answers, not good ones');
  assert.match(frame, /this week|noticing/i, 'what the assessment leads to');
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
  const t = pastDoorway();
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
  const score = scoreSkills(r);
  const hl = skillHighlights(score);

  // THE RANKING is the thing this test exists to prove — skill 3 highest, skill 10 lowest, by two-domain mean.
  const ranked = [...score.perSkill].sort((a, b) => b.mean - a.mean || a.no - b.no);
  assert.equal(ranked[0]!.no, 3, 'goal setting ranks strongest');
  assert.equal(ranked[ranked.length - 1]!.no, 10, 'relapse prevention ranks weakest');

  // AND IT RETURNS THE MEMBER'S WORDS. This asserted Greg's construct names ('Goal setting' / 'Relapse
  // prevention') — which is what the close and the Companion then said to a person, while her Playbook map called
  // the same skills something else. skillHighlights feeds both of those surfaces, so it speaks her language now.
  assert.equal(hl.strongest, SKILL_LABEL_CHECK[3], 'the close names it the way the map does');
  assert.equal(hl.growthEdge, SKILL_LABEL_CHECK[10]);
  assert.equal(hl.growthEdge, 'Getting back on after a slip');
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

// ONE SKILL, ONE NAME, ON EVERY SURFACE A MEMBER MEETS.
//
// The product spoke two languages about the same thing. She RATED "Consumer skills", the Session close told her
// "consumer skills is a strength of yours", the Companion's context said the same — and her Playbook map called it
// "Finding good information". Four surfaces, three in Greg's construct language and one in hers, with nothing
// connecting them. (Jay, 2026-08-23: honouring Greg's approach is what makes it hang together.)
//
// GREG'S NAMES ARE NOT GONE. They stay on the item, in the code, and in every stored score — which is what HE
// reads. Only what a member hears changed, and the rated stems are verbatim either way.
test('the assessment, the close, the Companion and the map all call a skill the same thing', async () => {
  const inst = await import('../lib/rebuild/skills-instrument.ts');
  const { buildSkillsMap } = await import('../lib/rebuild/skills-map.ts');

  // Skill 8 = "Consumer skills" — the one whose construct name reads as jargon. Make it the clear growth edge.
  const responses = inst.SKILL_ITEMS.map((it) => (it.skillNo === 8 ? 1 : 4));
  const score = inst.scoreSkills(responses);
  const expected = inst.SKILL_LABEL[8]!;

  const item = inst.SKILL_ITEMS.find((i) => i.skillNo === 8 && i.domain === 'activity')!;
  assert.equal(inst.skillLabel(item.skillNo, item.skill), expected, 'the assessment header');
  assert.equal(inst.skillHighlights(score).growthEdge, expected, 'the close + the Companion context');
  assert.ok(JSON.stringify(buildSkillsMap(score)).includes(expected), 'the Playbook map');

  // The construct survives where the science lives.
  assert.equal(item.skill, 'Consumer skills', "Greg's construct name is still on the item");
  assert.match(item.code, /^B2-PA8$/, 'and the code is unchanged');
  assert.match(item.stem, /find and interpret information/, 'the rated stem is untouched verbatim');
});

test('every one of the twelve skills has a member-facing name', () => {
  // A missing label would silently fall back to the construct, reintroducing the split one skill at a time.
  for (let no = 1; no <= 12; no++) {
    const label = SKILL_LABEL_CHECK[no];
    assert.ok(label && label.length > 3, `skill ${no} has no member-facing label`);
  }
});
