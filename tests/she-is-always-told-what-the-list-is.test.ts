// EVERY MEMBER IS TOLD WHAT THE RECLAIM LIST IS — including the one who talks.
//
// Donna's walk, 2026-08-30: "It does not include any of the three of my must includes: Reclaim · Reclaim List ·
// Goals … then, under this, was a cold field with my first entry placed."
//
// Her copy HAD shipped, two days earlier. It just sat behind a fork: with nothing parked she got the full
// introduction, and with a want already parked she got a short read-back that named none of it. The member most
// likely to take the short branch is the one who mentions something she wants while telling her story — which is
// most people, and certainly Donna. We told her it was live. It was live on the other branch.
//
// This is the defect class this repo keeps finding, in copy rather than code: the rule exists and does not run on
// every path. The read-back is still there — it is a good beat, and it proves nothing was dropped — but it is one
// beat inside the introduction now, not a replacement for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reclaimOpening } from '../lib/agent/onboarding-staged.ts';
import type { Collected } from '../lib/agent/onboarding.ts';

// The opener is a pure function of what has been collected — tested directly rather than by forcing a stage
// transition, which is the kind of setup that fails for reasons unrelated to the thing under test.
const base: Collected = {
  athleticPast: 'directed and produced', identityNoun: 'Maker',
  gap: 'I lost the job two years ago, a partnership fell through, and my father nearly died six months later.',
} as never;
const open = (parked?: string[]) => reclaimOpening(parked ? ({ ...base, reclaimList: parked } as never) : base);

test('HER THREE MUST-INCLUDES appear whether or not she parked a want earlier', () => {
  for (const [label, reply] of [['nothing parked', open()], ['a want parked', open(['a creative role that covers the bills'])]] as const) {
    assert.match(reply, /Reclaim List/, `${label}: the list is named`);
    assert.match(reply, /goals/i, `${label}: described as goals — her word`);
    assert.match(reply, /(what would start bringing that person back|vivid picture)/i, `${label}: the soft lead-in, not a cold ask`);
  }
});

test('the read-back survives — it proves nothing was dropped', () => {
  const reply = open(['a creative role that covers the bills', 'lose the 20 lbs']);
  assert.match(reply, /earlier you said you want/, 'her parked wants are read back to her');
  assert.match(reply, /a creative role that covers the bills/, 'in her own words');
});

test('THE FORK IS GONE — no branch can introduce the list without explaining it', () => {
  // Structural. A future edit that re-adds "if she has parked wants, say something shorter" would put a member
  // back in front of a cold field with no idea what it is for.
  const code = readFileSync(new URL('../lib/agent/onboarding-staged.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const fn = code.slice(code.indexOf('function reclaimOpening'), code.indexOf('\n}', code.indexOf('function reclaimOpening')));
  assert.ok(!/if \(parked\.length/.test(fn), 'reclaimOpening no longer forks on whether anything was parked');
  assert.match(fn, /return reclaimOpen\(c, c\.reclaimList \?\? \[\]\)/, 'one opener, always');
});
