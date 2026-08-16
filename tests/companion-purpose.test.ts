// THE COMPANION KNOWS WHAT IT IS FOR — and only on the surfaces we have walked.
//
// Context: a count of the shared prompt on 2026-08-16 found 45 prohibitions and one "suggest". The agent had
// been taught in detail what not to say and never told what it was for. Jay: "it's a product that has been
// taught what not to say and never taught what it's for."
//
// These tests exist because the statement is worthless if it is not actually IN the assembled prompt (test the
// seam, not the halves — a rule the agent never receives is a rule that does not exist), and DANGEROUS if it
// leaks into the onboarding capture engine, which is load-bearing and deliberately out of scope on first wiring.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WHAT_YOU_ARE_FOR, MEMBER_AGENT_SYSTEM_PROMPT } from '../lib/agent/system-prompt.ts';
import { checkinSystem } from '../lib/agent/checkin.ts';

const ctx = () =>
  ({ displayName: 'D', identityNoun: null, doorDisplayNames: [], idScore: null, direction: null,
     currentFocus: null, lastCompletedAsset: null, reclaimList: [] }) as never;

test('the purpose statement reaches the check-in prompt', () => {
  const sys = checkinSystem(ctx());
  assert.ok(sys.includes('WHAT YOU ARE FOR'), 'the heading is present');
  assert.ok(sys.includes(WHAT_YOU_ARE_FOR), 'the whole statement is present, not a paraphrase');
});

test('it is stated BEFORE the operating moment — a purpose after the limits reads as one more limit', () => {
  const sys = checkinSystem(ctx());
  assert.ok(sys.indexOf('WHAT YOU ARE FOR') < sys.indexOf('OPERATING MOMENT'), 'purpose precedes the moment');
});

test('SCOPE: it is NOT in the shared constant that the capture engine builds on', () => {
  // The guard that matters. MEMBER_AGENT_SYSTEM_PROMPT is the base for onboarding.ts and onboarding-staged.ts —
  // the capture loop, which took a long road to get right. Widening happens surface by surface, each with its
  // own walk; if someone moves this into the shared constant to "simplify", this fails and says why.
  assert.ok(!MEMBER_AGENT_SYSTEM_PROMPT.includes('WHAT YOU ARE FOR'),
    'purpose must not leak into the shared prompt — the onboarding capture engine is out of scope on first wiring');
});

test('it carries the three things that make it a job rather than a limit', () => {
  assert.ok(WHAT_YOU_ARE_FOR.includes('HOLD THE WHOLE PICTURE'), 'the noticing duty — Donna’s case, generalised');
  assert.ok(/then actually advise/.test(WHAT_YOU_ARE_FOR), 'the restored middle step of Elicit-Provide-Elicit');
  assert.ok(/create the conditions for clearer reflection/.test(WHAT_YOU_ARE_FOR), "Greg's closing line, verbatim");
});

test('it resolves the "you do not coach" contradiction rather than leaving it dangling', () => {
  // The shared prompt still opens with "You do not coach" — correct for onboarding capture, wrong here, and
  // Greg's MI Guidebook is explicit that the Companion must be able to pivot to BE a coach. Precedence is
  // stated in the text so the model is never holding two live contradictory instructions.
  assert.ok(MEMBER_AGENT_SYSTEM_PROMPT.includes('do not coach'), 'precondition: the shared line still exists');
  assert.ok(WHAT_YOU_ARE_FOR.includes('purpose governs'), 'and this layer says which one wins');
});

test('it never loosens governance', () => {
  assert.ok(/governance prohibitions, which are absolute/.test(WHAT_YOU_ARE_FOR),
    'the prohibitions stay absolute — this adds a purpose, it does not buy latitude');
});
