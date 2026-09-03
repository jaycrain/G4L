// "IF YOU WANT IT" — THE SAME NOTE, THREE TIMES, BECAUSE WE FIXED THE STRING SHE QUOTED.
//
// Donna, 2026-08-30, on the assessment closes: she answered "nah" once just to see what happened. Her diagnosis:
// it "leaves things hanging for the member to keep it moving forward", and "the information that comes after that
// isn't much of a payoff. Just serve it up." Her ask was explicit — remove the phrase **from all assessments**.
//
// B2 said "if you want THEM" and was fixed. B1 said "if you want IT" and was not. She walked Rebuild on 9/3, met
// it again, and wrote: "Should not say 'if you want it'. Remove that phrase and just share the info."
//
// THE PROMPT RULE HAD THE IDENTICAL FAULT: it banned "if you want them" by name, so the singular passed both the
// rule and the sweep. Twice over, a guard written from an example caught only the example. That is why this file
// tests the SHAPE and not the sentence. [[one-fact-many-sites]] [[rule-needs-its-exemplar]]
//
// AND THE DEEPER REASON IT MATTERS, in her words from the walk before: an offer implies what follows is optional
// extra, which sets a bar two short points do not need to clear. The Companion is not asking permission to be
// useful.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * THE HEDGE IS POSITIONAL, and my first version of this test missed that — it flagged eight legitimate lines,
 * including "If you want to stop after, you stop with a clean conscience", which is the Independence Guarantee
 * written out. Its own control test caught it.
 *
 *   TRAILING  → a hedge:       "…one thing worth knowing about what you just rated, if you want it."
 *   LEADING   → an instruction: "If you want that back, the list is where it goes."
 *
 * The first hands OUR decision to her. The second describes HER choice, which is the whole posture of the
 * product. So this matches only a trailing clause that closes the sentence. Add inflections here, not new tests.
 */
const HEDGED_OFFER =
  /,\s*if (?:you (?:want|like|'?d like|wish|prefer)(?: it| them)?|you'?re interested|that (?:would help|helps|'?s useful|is useful))\s*[.!?]*\s*(?=["'`]|$)/i;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Authored member copy is a quoted string; a comment explaining the ban is not. Strip comments before judging. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
}

test('NO AUTHORED STRING ENDS BY ASKING PERMISSION TO BE USEFUL', () => {
  const offenders: string[] = [];
  for (const dir of ['lib', 'app']) {
    for (const file of sourceFiles(new URL(`../${dir}`, import.meta.url).pathname)) {
      const code = codeOnly(readFileSync(file, 'utf8'));
      for (const [i, line] of code.split('\n').entries()) {
        // Only quoted copy — a regex that DETECTS the phrase (this file, the voice gate) is not an offence.
        if (!/["'`]/.test(line)) continue;
        if (/HEDGED_OFFER|HAS_EASY_OUT|NEVER "IF YOU WANT/.test(line)) continue;
        if (HEDGED_OFFER.test(line)) offenders.push(`${file.split('/').slice(-2).join('/')}:${i + 1} — ${line.trim().slice(0, 100)}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    `member copy hands the decision back instead of just saying the thing:\n  ${offenders.join('\n  ')}`);
});

test('the detector catches the inflections, not just the one she quoted', () => {
  // The regression this file exists for: "them" was banned, "it" shipped. Both must fail, and so must the next one.
  for (const s of [
    "one thing worth knowing about what you just rated, if you want it.",
    "That's the twenty-four. Two things worth knowing, if you want them.",
    'Here are a couple of notes, if you like.',
    "I can walk you through it, if you're interested.",
    'There is more on this, if that would help.',
  ]) assert.ok(HEDGED_OFFER.test(s), `not caught: "${s}"`);
});

test('and it does not eat a legitimate conditional', () => {
  // The failure in the other direction. "If you want X, do Y" is a real instruction about the member's own choice,
  // not a hedge on ours — over-matching would strip guidance that belongs to her.
  for (const s of [
    'If you want to stop here, stop here — this is yours to set the pace of.',
    'If you want that back, the list is where it goes.',
    "Tell me if you want to take a different one first.",
  ]) assert.ok(!HEDGED_OFFER.test(s), `false positive: "${s}"`);
});
