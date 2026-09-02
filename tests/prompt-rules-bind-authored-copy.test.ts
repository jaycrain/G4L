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
  // WIDENED 2026-09-02, from Donna: "for the love of God please eliminate the phrase 'There's (thing) done'.
  // that is not American English."
  //
  // The prompt bans this construction "in any form" and has since it was written. This entry implemented the
  // NARROWEST instance of it — an asset code, `that's B2` — so the rule was stated, taught to the model, guarded
  // by a test, and still shipped SIX times in authored copy: the Door close, the Reclaim sort, and four in the
  // practice week. A rule enumerated by instance always has the next instance outside it. [[one-fact-many-sites]]
  //
  // The exclusions are the legitimate English the pattern would otherwise swallow: "that's how it's done",
  // "what you've done", "that's not done". Announcing the end of a unit is the target, not the word.
  { banned: /\b(?:that|there)'?s\s+(?:the\s+|your\s+|a\s+|an\s+)?[\w''-]+(?:\s+[\w''-]+){0,3}\s+done\b/i,
    allow: /\b(?:that'?s\s+(?:how|what|why|when|not)\b|what\s+you'?ve\s+done|all\s+you'?ve\s+done)/i,
    provenInPrompt: /NEVER ANNOUNCE THE END OF A UNIT/ },
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
      // THE APOSTROPHE BUG, fixed 2026-09-02, and it made this whole guard partly blind.
      //
      // The old pattern was /['"`]([^'"`\\]{12,600})['"`]/ — one character class for BOTH the delimiter and the
      // forbidden interior. A straight apostrophe is in that class, so `"That's the week done."` was captured as
      // "s the week done." with `That'` eaten. Every rule that matches on a string's opening words could not fire
      // on any string containing a straight apostrophe — which is most of the Companion's voice.
      //
      // That is exactly how six violations of "never announce the end of a unit" shipped in files this guard was
      // already scanning, until Donna read them out loud: "for the love of God please eliminate the phrase."
      //
      // Now the delimiter is captured and the interior is anything up to the SAME delimiter, so an apostrophe
      // inside a double-quoted string is just a character. Curly apostrophes always worked, which is why this
      // survived — most authored copy uses them, and the straight ones looked like a style inconsistency.
      // ONE PATTERN PER DELIMITER. The interior may contain the OTHER quote characters — that is the whole point:
      // a double-quoted string is allowed to contain an apostrophe, and most of the Companion's voice does.
      // A single alternating class for both delimiter and interior is what broke this.
      for (const re of [/"([^"\\\n]{12,600})"/g, /'([^'\\\n]{12,600})'/g, /`([^`\\]{12,600})`/g]) {
        for (const m of body.matchAll(re)) out.push({ file: f, text: m[1]! });
      }
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

test('every file the inventory NAMES actually exists — a listed-but-missing file is skipped in silence', () => {
  // THIS IS WHY THE INVENTORY COULD ROT. authoredCopy() reads each listed file in a try/catch and `continue`s on
  // failure, so a file that has been deleted or moved contributes nothing and says nothing. On 2026-09-02 the list
  // still named app/dashboard/redesign-dashboard.tsx, deleted the day before with DASH_TRIPTYCH — the transcript
  // and this guard had both been quietly building from 76 files while believing they had 77.
  //
  // It matters twice over: this list defines what the prompt-rule guard SCANS, and it is the same list that builds
  // the Cowork transcript — the file marketing and the second-edition book quote from. A gap here is copy nobody
  // is checking and nobody can quote. [[swallowed-read-renders-as-truth]]
  const missing = (SECTIONS as { files: string[] }[])
    .flatMap((s) => s.files)
    .filter((f) => { try { readFileSync(new URL(`../${f}`, import.meta.url)); return false; } catch { return true; } });
  assert.deepEqual(missing, [], 'listed in transcript-sources.mjs but not on disk — fix the list or restore the file');
});

test('NO authored string says what the Companion is forbidden to say', () => {
  const violations: string[] = [];
  for (const { file, text } of authoredCopy()) {
    for (const { banned, allow } of BOUND) {
      if (banned.test(text) && !(allow && allow.test(text))) violations.push(`${file} — ${String(banned)} — "${text.slice(0, 80)}"`);
    }
  }
  assert.deepEqual(violations, [],
    'we gate the model against these; shipping one ourselves is the same failure with our name on it');
});
