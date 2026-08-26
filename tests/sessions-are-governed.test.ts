// A SESSION MUST RUN THE COMPANION UNDER THE SAME RULES AS EVERY OTHER SURFACE.
//
// Measured 2026-08-26: Reconnect prepends MEMBER_AGENT_SYSTEM_PROMPT; Rewire, Rebuild and Reclaim did not. All
// NINE governance rules were absent from their Session prompts — privacy, never-name-a-real-person,
// never-infer-gender, the AI-tell word list, the locked vocabulary, identity-is-not-an-address, what-you-are,
// reflect-and-route, never-narrate-the-machinery.
//
// Each was written because it had already reached a real member once. The costliest is PRIVACY: the block's own
// header records that "a member was assured 'this is between us' by something with no knowledge of how her data
// is held." That is a false statement about data handling, made to someone in the act of disclosing what they
// have told no one — and it is the promise a member most wants to hear, so it is exactly what an ungoverned
// model reaches for.
//
// REWIRE IS GOVERNED AS OF THIS COMMIT. Rebuild and Reclaim are NOT, deliberately: Jay is walking Rebuild right
// now and changing six live capture prompts at once is the shape this project reverts. They are listed below as
// KNOWN-UNGOVERNED so the gap is recorded rather than forgotten, and this test fails the day someone adds a new
// Rewire prompt without the block.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REWIRE_W3_SYSTEM } from '../lib/agent/rewire.ts';
import { MEMBER_AGENT_GOVERNED_CORE, MEMBER_AGENT_SYSTEM_PROMPT } from '../lib/agent/system-prompt.ts';

/** The nine rules, each with the incident it was written for. */
const RULES: Array<[string, string]> = [
  ['PRIVACY', 'a member was assured "this is between us"'],
  ['NEVER NAME A REAL PERSON', 'a name appeared mid-conversation and she had no idea who that was'],
  ['NEVER INFER GENDER', 'a member caring for her parents was called "the son"'],
  ['the shape of it', 'the AI-tell word list from Donna’s voice pass'],
  ['locked vocabulary', 'invented framing terms'],
  ['never a way you address', 'the Identity used as a routine form of address'],
  ['WHAT YOU ARE: an AI', 'what the Companion actually is, so it does not improvise an answer'],
  ['NEVER NARRATE THE MACHINERY', '"the system is being stubborn about the feeling piece"'],
  ['Never judge, grade, fix, or pathologize', 'the core posture'],
];

test('Rewire carries every governance rule', () => {
  const missing = RULES.filter(([probe]) => !REWIRE_W3_SYSTEM.includes(probe))
    .map(([probe, why]) => `${probe} — ${why}`);
  assert.deepEqual(missing, [], `a Rewire Session runs ungoverned:\n${missing.join('\n')}`);
});

test('the AI disclosure is NOT carried into a Session', () => {
  // It reads "first line of a member's FIRST conversation, verbatim" — dropped into a Session prompt it tells the
  // Companion to disclose it is an AI forty minutes into Rewire, to someone who was told at onboarding. This is
  // the one section that would do harm, which is why the core stops short of it.
  assert.ok(!MEMBER_AGENT_GOVERNED_CORE.includes('AI DISCLOSURE'));
  assert.ok(!REWIRE_W3_SYSTEM.includes('AI DISCLOSURE'));
  // ...and it must still ship where it belongs.
  assert.ok(MEMBER_AGENT_SYSTEM_PROMPT.includes('AI DISCLOSURE'), 'the disclosure was dropped from onboarding too');
});

test('the cached prefix clears the model’s cache minimum', () => {
  // Sonnet 4.6 will not cache a prefix under 2048 tokens — it silently writes nothing. Ungoverned these prompts
  // were ~650 tokens and could never cache; governed they are ~4700. The rules are what MAKE caching possible,
  // so a Session is cheaper governed than it was ungoverned.
  const approxTokens = REWIRE_W3_SYSTEM.length / 4;
  assert.ok(approxTokens > 2048, `prefix is ~${Math.round(approxTokens)} tokens — under the cache minimum`);
});

test('KNOWN-UNGOVERNED: Rebuild and Reclaim, recorded not forgotten', () => {
  // Deliberate as of 2026-08-26 — Rewire first, walked, then the other two. This assertion is a reminder with a
  // failure attached: when they are governed, update it rather than deleting it.
  const remaining = ['rebuild.ts (B3_SYSTEM)', 'reclaim.ts (REFINE_SYSTEM, C3_SYSTEM)'];
  assert.equal(remaining.length, 2, 'if a phase was governed, move it out of this list');
});
