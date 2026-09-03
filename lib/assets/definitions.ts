// Versioned asset content (registry). PLACEHOLDER protocols — the real Atlas content drops
// in here as swappable, versioned data; the engine renders any definition generically.
// R-4 carries an A/B variant pair to exercise the Reconnect experiment (CONTRACTS §5).

import type { AssetDefinition, AssetVariant } from './types.ts';

export const ASSET_NAMES: Record<string, string> = {
  'R-1': 'The Distance', // member-facing; the IDQ is the instrument behind it (see session-registry.ts)
  'R-4': 'Identity Excavation',
  'R-6': 'Window Exercise',
  'W-1': 'Disinformation Audit',
  'W-3': 'Visualization Workshop',
  'W-5': 'False Start Protocol',
  'B-1': 'First Step Assessment',
  'B-2': 'Appreciating Your Strengths and Weaknesses',
  'B-3': 'First 1,000 Miles',
  'B-5': 'Fuel Plan',
  'C-1': 'Looking Forward',
  'C-3': 'Adventure Planning Worksheet',
  'C-5': 'Your Success Story',
};

const VERSION = '0.1-draft';

// Generic placeholder protocol for any asset without bespoke content yet.
function defaultDefinition(code: string): AssetDefinition {
  const title = ASSET_NAMES[code] ?? code;
  return {
    code,
    version: VERSION,
    title,
    intro: `${title} — a guided exercise. (Draft content; the Atlas protocol drops in here.)`,
    steps: [
      { type: 'prose', body: 'Take a few minutes with this. There are no wrong answers.' },
      { type: 'prompt', input: { kind: 'textarea', key: 'response', label: 'What comes up for you here?', required: true } },
      { type: 'reflection', key: 'reflection', label: 'One line on what shifted, if anything.' },
    ],
  };
}

// R-4 Identity Excavation — A/B (Excavation+Window vs Doors+Spark; Decision Log Jun 4).
const R4_A: AssetDefinition = {
  code: 'R-4',
  version: VERSION,
  variant: 'a',
  title: 'Identity Excavation',
  intro: 'Variant A — Excavation + Window. (Draft.)',
  scienceCheckRef: 'greg.science_check.R-4',
  steps: [
    { type: 'prose', body: 'We dig for the version of you the years covered over.' },
    { type: 'prompt', input: { kind: 'list', key: 'excavated', label: 'Name parts of yourself you miss.', count: 3, required: true } },
    { type: 'reflection', key: 'reflection', label: 'Which one still has a pulse?' },
  ],
};
const R4_B: AssetDefinition = {
  ...R4_A,
  variant: 'b',
  intro: 'Variant B — Doors + Spark. (Draft.)',
  steps: [
    { type: 'prose', body: 'We start from the door that opened, and look for the spark on the other side.' },
    { type: 'prompt', input: { kind: 'textarea', key: 'spark', label: 'When did you last feel most like yourself?', required: true } },
    { type: 'reflection', key: 'reflection', label: 'What was present then that is missing now?' },
  ],
};

// --- Rebuild wing — authored from Dr. Greg Welk's content (Jun 2026). ---------------------
const GREG_VERSION = '0.2-rebuild-draft';

// B-1 First Step Assessment (Greg's "Asset R1")
const B1_DEF: AssetDefinition = {
  code: 'B-1',
  version: GREG_VERSION,
  title: 'First Step Assessment',
  intro:
    "Before you take a single step, you need to know where you're standing. The Rewire taught you to replace feelings with data; this applies that discipline to your body. Some of these numbers will be hard to face. That's fine — Jay's starting numbers were terrible: a resting heart rate that embarrassed him, a weight he'd been avoiding for years, bloodwork that scared his doctor. Every one of them became a measuring stick that proved the framework was working. Your numbers are your starting line. Not your verdict.",
  steps: [
    { type: 'prose', body: 'Part A — Lifestyle Habit Audit. Across four areas — physical activity, nutrition, stress and habits, and lifestyle management — take honest stock of where your habits stand today. (Adapted from the AHA’s Life’s Essential 8.)' },
    { type: 'prose', body: 'Part B — The Body Right Now. Record your baseline: weight, BMI, waist, resting heart rate, blood pressure, cholesterol, A1c. If you don’t know a number, estimate it or schedule the test and note the date.' },
    { type: 'prose', body: 'Part C — You are not asked to share your numbers. You are asked to share the experience of looking at them. The honesty is what connects.' },
    { type: 'prompt', input: { kind: 'textarea', key: 'experience', label: 'Looking at your baseline — what surprised you, what scared you, what motivated you?' } },
    { type: 'reflection', key: 'reflection', label: 'Which one number will you make your measuring stick?' },
  ],
  scienceCheck: {
    title: 'Why the first step matters',
    body: 'Physical inactivity acts as an accelerant that roughly doubles the rate of physiological decline — and about half of the decline we associate with aging is preventable. A baseline gives you real information to work with: not guesses, not how you feel, but where you actually are. The jump from zero to something is the most important transition there is.',
    attribution: 'Dr. Greg Welk',
  },
};

// B-2 Appreciating Your Strengths and Weaknesses — self-management skills (Greg's "Asset R2", new)
const B2_DEF: AssetDefinition = {
  code: 'B-2',
  version: GREG_VERSION,
  title: 'Appreciating Your Strengths and Weaknesses',
  intro:
    "The Rebuild is about building the skills to sustain a healthy lifestyle over time. Before you start, take honest stock of your self-management skills — the ones that get you where you want to go. Like any skill, you improve them by practicing. This activity asks for an honest read on twelve core skills; then you'll watch how they help or hinder you over the coming week. The focus isn't on monitoring your behavior — it's on noticing the skills underneath it.",
  steps: [
    { type: 'prose', body: 'Part A — Self-Management Assessment. Rate yourself across twelve core skills, for both physical activity and nutrition: self-assessment, self-monitoring, goal-setting, planning, performance skills, balancing attitudes, overcoming barriers, consumer skills, social support, relapse prevention, time management, and confidence/motivation.' },
    { type: 'prose', body: 'These group into three families: what predisposes you to act, what enables the action, and what reinforces it over time. You will likely be strong in some and thin in others — that is the point.' },
    { type: 'prompt', input: { kind: 'textarea', key: 'strengths', label: 'Which of these are real strengths for you — and which are the weak spots?' } },
    { type: 'prose', body: 'Part B — Track & Reflect. Over the coming week, log decisions about activity and eating. Don’t try to change anything yet — just notice which skills showed up when you made a healthy choice, and which were missing when you didn’t.' },
    { type: 'reflection', key: 'reflection', label: 'Which single skill, if you strengthened it, would change the most?' },
  ],
};

// B-5 Fuel Plan — the Lifestyle Pilot (Greg's "Asset R3")
const B5_DEF: AssetDefinition = {
  code: 'B-5',
  version: GREG_VERSION,
  title: 'Fuel Plan',
  intro:
    "Diet and movement are the primary drivers of health — and the evidence says midlife bodies do better when the two are linked intentionally, as one “fuel to move” lifestyle. This is a four-week pilot to build a plan that’s practical and sustainable, not dramatic and short-lived.",
  steps: [
    { type: 'prose', body: 'Week 1 — Self-monitoring. Don’t change anything yet. Log your decisions about eating and moving, and the obstacles you didn’t see coming. Notice how the two behaviors complement each other.' },
    { type: 'prose', body: 'Week 2 — Link them into a plan. Build a manageable “fuel to move” plan where eating and activity reinforce each other — designed so you don’t burn out.' },
    { type: 'prose', body: 'Week 3 — Barriers and challenges. Some successes, some failures — both are information. The daily ups and downs are bumps in the road, not detours.' },
    { type: 'prose', body: 'Week 4 — Metabolism and muscle. The goal isn’t just fewer calories; it’s preserving muscle and avoiding sarcopenia while you fuel the work.' },
    { type: 'prompt', input: { kind: 'textarea', key: 'plan', label: 'Sketch your first “fuel to move” week — one change to how you eat, one to how you move.' } },
    { type: 'reflection', key: 'reflection', label: 'What did tuning into “fuel to move” change about how the week felt?' },
  ],
  scienceCheck: {
    title: 'Nutrition and activity for midlife',
    body: 'A diet isn’t something you go on — it’s something you have, adopted over time and sustained. Favor nutrient-dense foods — fruits, vegetables, whole grains, legumes, nuts — and limit added sugars, sodium, and ultra-processed foods. The body regulates weight like a thermostat: cut calories alone and it fights back by slowing metabolism, which is why regular movement is non-optional for long-term weight management. And the two work best together — in a cohort of 7,000+ midlife adults, improving diet quality and physical activity at the same time produced the greatest reduction in visceral fat, the evidence behind treating fuel and movement as one plan (Aryannezhad et al., JAMA Network Open, 2025).',
    attribution: 'Dr. Greg Welk',
  },
};

// B-3 First 1,000 Miles (Greg's "Asset 6")
const B3_DEF: AssetDefinition = {
  code: 'B-3',
  version: GREG_VERSION,
  title: 'First 1,000 Miles',
  intro:
    "The first 1,000 miles are the hardest. And the most important — they’re the miles that prove to your brain that the Rewire is real, that the person you reconnected with is coming back. Jay rode 3,306 miles in his first year. Fifty pounds gone. The body wants to move and be well; you just have to give it the chance. This tracker adapts to your vehicle — walk, swim, or ride. The number matters less than the commitment to tracking it.",
  steps: [
    { type: 'prose', body: 'Mile 0–100 · The Pattern Break (Month 1). The hardest stretch — your body is adapting but you can’t see it yet. Track days active vs. inactive; the ratio matters more than the volume. When the first false start comes — and it will — clip back in the next day.' },
    { type: 'prose', body: 'Mile 100–300 · The Evidence (Months 2–3). You start to feel it: resting heart rate drops, the scale moves, you recover faster. Post your 100-mile mark in the community.' },
    { type: 'prose', body: 'Mile 300–600 · The Shift (Months 4–6). Other people notice. Bloodwork improves. Retake your First Step Assessment and compare. Set a real measuring-stick event and put a date on it.' },
    { type: 'prose', body: 'Mile 600–1,000 · The Identity (Months 7–12). Movement is something you do, not something you make yourself do. The question shifts from “can I?” to “what’s next?”' },
    { type: 'prompt', input: { kind: 'text', key: 'measuring_stick', label: 'Name one measuring-stick event the Mile-0 you couldn’t have done — and a date.' } },
    { type: 'reflection', key: 'reflection', label: 'Where are you on the arc right now — and what’s the next 100 miles?' },
  ],
  scienceCheck: {
    title: 'The body’s adaptation timeline',
    body: 'The body responds faster than most people expect. Within two to four weeks of consistent exercise: more energy, better sleep, less perceived effort. By three months the changes show up on clinical markers. By twelve months you are, physiologically, a different person. The body adapts and recovers at any age — patience and Grinta are what the process asks of you.',
    attribution: 'Dr. Greg Welk',
  },
};

const REGISTRY: Record<string, AssetDefinition> = { 'B-1': B1_DEF, 'B-2': B2_DEF, 'B-3': B3_DEF, 'B-5': B5_DEF };

export function getAssetDefinition(code: string, variant?: AssetVariant): AssetDefinition {
  if (code === 'R-4') return variant === 'b' ? R4_B : R4_A;
  return REGISTRY[code] ?? defaultDefinition(code);
}
