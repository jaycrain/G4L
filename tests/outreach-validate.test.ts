import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOutreach, type ValidateContext } from '../lib/outreach/validate.ts';
import type { OutreachDraft, OutreachTrigger, Tense, Provenance } from '../lib/outreach/config.ts';

// The pre-send validator against the Governance §12 worked examples — the bar. Every GOOD passes; every BAD is
// HELD, and (where it matters) on the intended rule. All BADs carry real provenance + legal cadence so they fail
// on their governance violation, not on a missing precondition.

const OK: ValidateContext = { cadenceOk: true, dismissible: true };
const prov = (): Provenance => ({ stream: 'words', ref: 'chat:123', quote: 'fine' });

const draft = (over: Partial<OutreachDraft> & { text: string; trigger: OutreachTrigger; tense: Tense }): OutreachDraft => ({
  provenance: prov(),
  hasPlan: false,
  questionCount: 1,
  ...over,
});

// ── §12 GOOD — must PASS ─────────────────────────────────────────────────────────────────────────
test('§12 GOOD examples all pass the validator', () => {
  const goods: OutreachDraft[] = [
    // Present · reflection + one open question (no explicit tag — the question is the open hand).
    draft({
      trigger: 'morning_presence', tense: 'present',
      text: "Yesterday you said the word fine about that conversation — the same word you used before the one you told me you regretted. What's underneath fine today?",
    }),
    // Practice · an earned plan, framed as an invitation with an easy out.
    draft({
      trigger: 'pattern', tense: 'practice', hasPlan: true, questionCount: 0,
      text: "Your mornings are strong; the slips tend to cluster. If you're up for it, tomorrow we try one rep earlier — speak first in the standup, one sentence. Or not — your call.",
    }),
    // Reclaim-list nudge · invitation toward their OWN goal, explicit easy out.
    draft({
      trigger: 'reclaim_milestone', tense: 'present',
      text: 'You put one honest conversation a week on your list — that was your idea. There is room for it today if you want it. No pressure either way.',
    }),
    // Post-log · reflection + one either/or question, easy out.
    draft({
      trigger: 'post_log', tense: 'present',
      text: "I noticed you logged that difficult conversation from your Reclaim List. Want to capture how it went — or just sit with it? Either's fine.",
    }),
    // Re-engagement · warm, zero guilt.
    draft({
      trigger: 're_engagement', tense: 'present', provenance: { stream: 'pattern', ref: 'absence:5d' },
      text: "Good to see you. No need to explain the gap — the practice waits for you. What's here today?",
    }),
    // Science-check · calibrated language ("can help"), no overclaim.
    draft({
      trigger: 'reclaim_milestone', tense: 'present', questionCount: 0,
      text: 'Revisiting your list now can help you see which goals still feel like yours. No pressure — whenever you want.',
    }),
  ];
  for (const g of goods) {
    const r = validateOutreach(g, OK);
    assert.ok(r.ok, `should PASS but failed: "${g.text.slice(0, 40)}…" → ${r.failures.join(' | ')}`);
  }
});

// ── §12 BAD — must be HELD, on the intended rule ─────────────────────────────────────────────────
test('§12 BAD examples are held on the right governance rule', () => {
  const cases: { d: OutreachDraft; rule: RegExp }[] = [
    { rule: /righting reflex|command/, d: draft({ trigger: 'morning_presence', tense: 'present', questionCount: 0, text: 'You should journal about your feelings.' }) },
    { rule: /invitation/, d: draft({ trigger: 'pattern', tense: 'practice', hasPlan: true, questionCount: 0, text: 'Do your rep now.' }) },
    { rule: /guilt/, d: draft({ trigger: 'reclaim_milestone', tense: 'present', questionCount: 0, text: "You still haven't had your honest conversation this week." }) },
    { rule: /bare number/, d: draft({ trigger: 'post_log', tense: 'present', questionCount: 0, text: 'Rate how it went 1–10.' }) },
    { rule: /guilt/, d: draft({ trigger: 're_engagement', tense: 'present', questionCount: 0, text: "You've missed 4 days. Your streak is broken." }) },
    { rule: /science-check/, d: draft({ trigger: 'reclaim_milestone', tense: 'present', questionCount: 0, text: 'This exercise reveals your true priorities.' }) },
  ];
  for (const { d, rule } of cases) {
    const r = validateOutreach(d, OK);
    assert.equal(r.ok, false, `should be HELD: "${d.text}"`);
    assert.ok(r.failures.some((x) => rule.test(x)), `"${d.text}" held on ${JSON.stringify(r.failures)}, expected ${rule}`);
  }
});

// ── the system-property gates ────────────────────────────────────────────────────────────────────
test('grounded / cadence / dismissible gates hold', () => {
  const base = draft({ trigger: 'morning_presence', tense: 'present', text: "What's here for you today?" });
  assert.ok(validateOutreach({ ...base, provenance: null }, OK).failures.some((f) => /grounded/.test(f)), 'no provenance → held');
  assert.ok(validateOutreach(base, { cadenceOk: false, dismissible: true }).failures.some((f) => /cadence/.test(f)), 'over cadence → held');
  assert.ok(validateOutreach(base, { cadenceOk: true, dismissible: false }).failures.some((f) => /dismissible/.test(f)), 'not dismissible → held');
});
