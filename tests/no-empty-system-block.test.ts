// AN EMPTY SYSTEM BLOCK KILLS THE WHOLE REQUEST.
//
// C3 · Quality Days, found by the gate on 2026-09-04 the first time anything walked that far:
//
//     400 invalid_request_error: "system: text content blocks must be non-empty"
//
// Its second system block is the carry-forward ALONE — `carryForward ? `\n\n${carryForward}` : ''` — so a member
// with no carry-forward sends an empty block, the API rejects the entire request, and they get "Something went
// wrong" with no way past it. A hard dead end, on the same shape Jennifer had just spent two days inside.
//
// DONNA COMPLETED C3, which is why nobody knew. She happened to have carry-forward. Nothing about the Session was
// working — she was the lucky case, and a member arriving without it is simply blocked.
//
// The other arcs concatenate a context string and a stage note before the carry-forward, so they are non-empty by
// LUCK rather than by rule. This makes it a rule, in one place, for all four and for whatever comes next.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { systemBlocks } from '../lib/agent/onboarding-staged.ts';

test('an empty block is dropped, and a real one survives', () => {
  const out = systemBlocks([
    { type: 'text', text: 'THE PROMPT', cache_control: { type: 'ephemeral' } },
    { type: 'text', text: '' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.text, 'THE PROMPT');
  assert.deepEqual(out[0]!.cache_control, { type: 'ephemeral' }, 'the cache breakpoint must survive the filter');
});

test('whitespace-only counts as empty — the API is not fooled and neither is this', () => {
  assert.equal(systemBlocks([{ type: 'text', text: 'REAL' }, { type: 'text', text: '\n\n  ' }]).length, 1);
});

test('EVERYTHING empty throws rather than sending a promptless request', () => {
  // A different bug, and one that must not hide inside this fix: an arc that built no prompt at all should fail
  // loudly here rather than quietly ask the model to improvise with no instructions.
  assert.throws(() => systemBlocks([{ type: 'text', text: '' }, { type: 'text', text: '   ' }]), /no prompt at all/);
});

test('EVERY ARC ROUTES ITS SYSTEM ARRAY THROUGH THE GUARD', () => {
  // The one that matters: a fifth arc, or a new live turn in an existing one, must not hand-roll `system: [...]`
  // and reintroduce this. Source-level because the alternative is discovering it from a 400 in someone's Session.
  const offenders: string[] = [];
  for (const f of readdirSync(new URL('../lib/agent', import.meta.url).pathname).filter((x) => x.endsWith('.ts'))) {
    const src = readFileSync(new URL(`../lib/agent/${f}`, import.meta.url), 'utf8');
    for (const [i, line] of src.split('\n').entries()) {
      if (/^\s*system: \[/.test(line)) offenders.push(`${f}:${i + 1}`);
    }
  }
  assert.deepEqual(offenders, [],
    `these build a system array without the empty-block guard: ${offenders.join(', ')}`);
});
