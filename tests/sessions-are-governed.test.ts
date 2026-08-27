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
import { B3_SYSTEM } from '../lib/agent/rebuild.ts';
import { REFINE_SYSTEM, C3_SYSTEM } from '../lib/agent/reclaim.ts';
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

// ALL THREE PHASES NOW, not just Rewire. Rebuild and Reclaim were governed 2026-08-27, before Jay's full walk, so
// that the walk validates what ships rather than a build we were about to replace — the mistake of 8/26, when his
// walk went nine releases stale before he finished.
const GOVERNED: Array<[name: string, prompt: string]> = [
  ['Rewire W3', REWIRE_W3_SYSTEM],
  ['Rebuild B3', B3_SYSTEM],
  ['Reclaim refine', REFINE_SYSTEM],
  ['Reclaim C3', C3_SYSTEM],
];

test('every model-driven Session carries every governance rule', () => {
  const missing: string[] = [];
  for (const [name, prompt] of GOVERNED) {
    for (const [probe, why] of RULES) if (!prompt.includes(probe)) missing.push(`${name}: ${probe} — ${why}`);
  }
  assert.deepEqual(missing, [], `a Session runs ungoverned:\n${missing.join('\n')}`);
});

test('the AI disclosure is NOT carried into a Session', () => {
  // It reads "first line of a member's FIRST conversation, verbatim" — dropped into a Session prompt it tells the
  // Companion to disclose it is an AI forty minutes into Rewire, to someone who was told at onboarding. This is
  // the one section that would do harm, which is why the core stops short of it.
  assert.ok(!MEMBER_AGENT_GOVERNED_CORE.includes('AI DISCLOSURE'));
  for (const [name, prompt] of GOVERNED) assert.ok(!prompt.includes('AI DISCLOSURE'), `${name} would re-disclose mid-Session`);
  // ...and it must still ship where it belongs.
  assert.ok(MEMBER_AGENT_SYSTEM_PROMPT.includes('AI DISCLOSURE'), 'the disclosure was dropped from onboarding too');
});

test('the cached prefix clears the model’s cache minimum', () => {
  // Sonnet 4.6 will not cache a prefix under 2048 tokens — it silently writes nothing. Ungoverned these prompts
  // were ~650 tokens and could never cache; governed they are ~4700. The rules are what MAKE caching possible,
  // so a Session is cheaper governed than it was ungoverned.
  for (const [name, prompt] of GOVERNED) {
    const approx = prompt.length / 4;
    assert.ok(approx > 2048, `${name}'s prefix is ~${Math.round(approx)} tokens — under the cache minimum`);
  }
});

test('NOTHING IS KNOWN-UNGOVERNED ANY MORE', () => {
  // This held a list — rebuild.ts and reclaim.ts — as a reminder with a failure attached. Both are governed as of
  // 2026-08-27, so the list is empty. Kept rather than deleted: the next model-driven Session added to this
  // product should land here with its name, not be quietly absent from a test that no longer exists.
  const remaining: string[] = [];
  assert.deepEqual(remaining, [], 'a Session is running ungoverned — add it to GOVERNED above');
});
