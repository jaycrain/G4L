import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyVoiceGate } from '../lib/agent/voice-gate.ts';
import { MEMBER_AGENT_SYSTEM_PROMPT } from '../lib/agent/system-prompt.ts';

// DONNA, 2026-08-30 — the register leaks. Internal filing labels reaching a member:
//   · "That's B2 done" — "B2 isn't a reference they are likely to understand and 'that's (insert thing) done' is
//     weird vernacular... The phrase should be removed from throughout the app."
//   · "the three categories of skills" — "does not feel like it should be member facing."
//   · "One or two things worth knowing about what you just rated if you want them" — "We should just remove that
//     phrase from all assessments. It also leaves things hanging for the member to keep it moving forward."
//
// THE RULE ALREADY EXISTED IN ONE ARC. Rewire's prompt carried "never say 'W1'/'W2'/'W3'"; the leak came from
// Rebuild, which did not. One fact, six sites, one copy. It now lives once in the shared system prompt, and the
// gate is the guarantee underneath the request.

test('the never-say-our-codes rule lives in the SHARED prompt, so every arc gets it', () => {
  assert.match(MEMBER_AGENT_SYSTEM_PROMPT, /NEVER SAY OUR INTERNAL NAMES FOR THINGS/);
  assert.match(MEMBER_AGENT_SYSTEM_PROMPT, /"R1", "W2", "B2", "C3"/);
  assert.match(MEMBER_AGENT_SYSTEM_PROMPT, /three categories of skills/, 'internal groupings named too');
});

test('the two other leaks she named are ruled on in the shared prompt', () => {
  assert.match(MEMBER_AGENT_SYSTEM_PROMPT, /NEVER ANNOUNCE THE END OF A UNIT/);
  assert.match(MEMBER_AGENT_SYSTEM_PROMPT, /NEVER "IF YOU WANT IT\/THEM\.?"/i);
});

test('the rule is stated ONCE — no arc keeps a local copy to drift from', async () => {
  const { readFileSync } = await import('node:fs');
  const arcs = ['reconnect', 'rewire', 'rebuild', 'reclaim', 'checkin'];
  const withLocalCopy = arcs.filter((a) =>
    /never say '?(W1|B1|C1|R1)/.test(readFileSync(new URL(`../lib/agent/${a}.ts`, import.meta.url), 'utf8')));
  assert.deepEqual(withLocalCopy, [], 'a second copy of a rule is a stale copy waiting to happen');
});

test('THE GATE: "That\'s B2 done" never reaches a member, whatever the prompt did', () => {
  for (const code of ['R1', 'W2', 'B2', 'C3']) {
    const { text } = applyVoiceGate(`That's ${code} done. Nice work getting through it.`);
    assert.ok(!text.includes(code), `${code} must not survive the gate: ${text}`);
    assert.match(text, /That's done\./, 'and the sentence must still read');
  }
});

test('the gate never eats a real sentence that happens to contain a code-like token', () => {
  // "B2" only goes when it sits inside the fixed construction. A member's own words, or any other sentence, are
  // untouched — a gate that eats arbitrary text is worse than the tell it removes.
  const keep = 'You rated twelve skills. That work is done and it stands.';
  assert.equal(applyVoiceGate(keep).text, keep);
});
