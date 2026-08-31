import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SECTIONS } from '../scripts/transcript-sources.mjs';
import { MEMBER_AGENT_SYSTEM_PROMPT } from '../lib/agent/system-prompt.ts';

// A RULE WE ENFORCE ON THE COMPANION MUST ALSO BIND OUR OWN AUTHORED COPY.
//
// Twice in two days we gated the model against a sentence we ship hardcoded:
//
//   · v3.5.79 added "OFFER, OR DON'T — NEVER 'IF YOU WANT THEM'" to the prompt while that exact phrase sat in
//     rebuild.ts. Donna answered "nah" to it on her walk.
//   · The Reconnect phase opener ended "there are no right or wrong answers" — verbatim the reassurance the
//     prompt forbids, shipped to every member entering the program.
//
// Both were found by a person reading the product. Neither needed to be: the rule is written down, the copy is a
// string, and a machine can compare them. That is what this does.
//
// SELF-VALIDATING IN BOTH DIRECTIONS, which is the part that matters. A hand-kept ban list drifts from the prompt
// it claims to mirror and then reports green about a rule nobody enforces any more — the exact defect class this
// repo keeps paying for. So each entry must ALSO still be findable in the prompt, or this test fails as stale.

/** Phrases the system prompt forbids, each paired with the prompt text that proves the rule is still live. */
const BOUND = [
  { banned: /\bif you want them\b/i, provenInPrompt: /NEVER "IF YOU WANT THEM\."/ },
  { banned: /\bif you'?re interested\b/i, provenInPrompt: /if you'?re interested/ },
  { banned: /\bno (right or )?wrong answers\b/i, provenInPrompt: /no wrong answers/ },
  { banned: /\bnot a (test|grade|score|judgment)\b/i, provenInPrompt: /"not a score", "not a grade", "not a test"/ },
  { banned: /\bno scor(es|ing)\b/i, provenInPrompt: /"no scores" \/ "no scoring"/ },
  { banned: /\bthat'?s [A-Z]\d\b/, provenInPrompt: /NEVER ANNOUNCE THE END OF A UNIT/ },
  { banned: /\b(?:R[1-4]|W[1-3]|B[1-4]|C[1-4]) (?:is|was|done)\b/, provenInPrompt: /NEVER SAY OUR INTERNAL NAMES/ },
];

/** Every authored member-facing string, from the same source of truth the Cowork transcript is built from. */
function authoredCopy(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const s of SECTIONS as { files: string[] }[]) {
    for (const f of s.files) {
      let src = '';
      try { src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'); } catch { continue; }
      // Comments explain the rules and quote the banned phrases on purpose — they are not what a member reads.
      const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      for (const m of body.matchAll(/['"`]([^'"`\\]{12,600})['"`]/g)) out.push({ file: f, text: m[1]! });
    }
  }
  return out;
}

test('the ban list still mirrors the prompt — a stale entry fails LOUD rather than passing quietly', () => {
  const stale = BOUND.filter((b) => !b.provenInPrompt.test(MEMBER_AGENT_SYSTEM_PROMPT));
  assert.deepEqual(stale.map((s) => String(s.banned)), [],
    'this rule is no longer in the prompt — either restore it there or drop it here, but do not let them disagree');
});

test('the scan actually reaches authored copy — an empty scan passes vacuously', () => {
  const copy = authoredCopy();
  assert.ok(copy.length > 500, `expected the authored corpus, found ${copy.length} strings`);
});

test('NO authored string says what the Companion is forbidden to say', () => {
  const violations: string[] = [];
  for (const { file, text } of authoredCopy()) {
    for (const { banned } of BOUND) {
      if (banned.test(text)) violations.push(`${file} — ${String(banned)} — "${text.slice(0, 80)}"`);
    }
  }
  assert.deepEqual(violations, [],
    'we gate the model against these; shipping one ourselves is the same failure with our name on it');
});
