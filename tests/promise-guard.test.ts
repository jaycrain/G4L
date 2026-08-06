// NEVER PROMISE CONTACT WE DON'T SEND.
//
// Rebuild B3 closed with "I'll check in on you every day." Reclaim C3 closed with "each day I'll ask how much the
// day felt like a quality one." Neither is sent. The daily nudge requires a browser push opt-in most members never
// give, holds a 72-hour cooldown, and deliberately skips anyone active in the last 24 hours — so for a member who is
// actually working the program it can never arrive.
//
// Greg finished B3 on 2026-08-06, was told to expect a daily check-in, and waited. A member told to expect contact
// and given none doesn't conclude the scheduler is misconfigured; they conclude they were dropped. For a product
// whose whole premise is being a place it's safe to be honest, that is the most expensive kind of copy bug.
//
// So the rule is structural: member-facing copy may TELL THEM WHAT TO DO ("go to the Momentum card each day and log
// it" — W3's close, which was always right). It may not promise that WE will reach out on a cadence, until there is
// a channel that actually delivers on it. When outreach ships for real, relax this guard deliberately — don't let a
// close quietly re-acquire the promise first.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// First person, us contacting them, on a cadence. Deliberately narrow: it must be OUR action ("I'll ask", "we'll
// check in"), not the member's ("log each day"), and it must carry a recurring cadence.
const PROMISES: { re: RegExp; why: string }[] = [
  {
    re: /\b(?:i|we)(?:'| w)?(?:ll| will)\s+(?:\w+\s+){0,3}?(?:check in|ask|remind|nudge|message|text|email|prompt)\b(?:[^.?!]{0,60}?)\b(?:every|each)\s+(?:day|morning|evening|night|week)\b/i,
    why: "promises recurring outreach we don't send — say what the MEMBER does instead (see W3_STEP3_1)",
  },
  {
    re: /\b(?:every|each)\s+day\s+(?:i|we)(?:'| w)?(?:ll| will)\s+(?:check in|ask|remind|nudge|message|text|email|prompt)\b/i,
    why: "same promise, inverted word order",
  },
  {
    re: /\bi'?ll\s+(?:be\s+)?(?:checking in|asking)\s+(?:\w+\s+){0,3}?(?:every|each)\s+day\b/i,
    why: "same promise, progressive form",
  },
];

// The member-facing conversational surfaces. Scoped to the arcs + agent copy — this is where a close lives.
const ROOTS = ['lib/agent', 'lib/curriculum/content', 'lib/content'];
const EXTS = new Set(['.ts', '.tsx']);
const SELF = 'promise-guard.test.ts';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.has(p.slice(p.lastIndexOf('.'))) && !p.endsWith(SELF)) out.push(p);
  }
  return out;
}

test('no arc promises a daily check-in it cannot deliver', () => {
  const offenders: string[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        // Skip comment lines — this file's own explanation, and the notes left at each fixed site, describe the
        // banned phrasing on purpose.
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        for (const { re, why } of PROMISES) {
          if (re.test(line)) offenders.push(`${file}:${i + 1} — ${why}\n    ${line.trim().slice(0, 140)}`);
        }
      });
    }
  }
  assert.deepEqual(offenders, [], `A member is being promised contact we don't send:\n${offenders.join('\n')}`);
});

test('the guard actually catches the two lines that shipped', () => {
  // A guard that matches nothing is worse than no guard, because it reads as coverage. These are the exact strings
  // that were live in prod until 2026-08-06.
  const shipped = [
    "I'll check in on you every day. It's a good time to talk with other Community members too.",
    "For the next week, each day I'll ask how much the day felt like a quality one.",
  ];
  for (const line of shipped) {
    assert.ok(PROMISES.some(({ re }) => re.test(line)), `guard misses a promise that really shipped: "${line}"`);
  }
});

test('telling the MEMBER what to do daily is fine — that is the fix, not the bug', () => {
  const fine = [
    'Go to the Momentum card on your dashboard every day and log your good calls, your false starts and even quiet days.',
    'Start tomorrow. Go to the Momentum card on your dashboard each day and log how it went.',
    'For the next week, log each day from your dashboard.',
    'Add a little more detail each day.',
  ];
  for (const line of fine) {
    assert.ok(!PROMISES.some(({ re }) => re.test(line)), `guard over-fires on member instruction: "${line}"`);
  }
});
