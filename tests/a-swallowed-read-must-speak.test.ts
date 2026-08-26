// A SWALLOWED READ THAT RENDERS AS A FACT ABOUT THE MEMBER MUST SAY SO.
//
// `catch { return [] }` on a database read manufactures a confident lie: the caller cannot tell a failure from a
// genuine empty, and the surface states the empty as truth. Found live on 2026-08-26 in the Rebuild ceremony,
// where a failed keeper read did not degrade the "here's what you kept" beat — it DELETED it, and the member
// finished the phase without being shown the plan they wrote.
//
// A codebase-wide sweep found 27 of the shape. EIGHTEEN return `null` and are correct — null means unknown, the
// callers degrade deliberately, and several carry a comment saying why. Three more are JSON.parse fallbacks where
// a malformed string genuinely IS no payload. The dangerous ones are database reads whose empty result the
// product renders as a statement: your Playbook is empty, you have never spoken to your Companion, there is
// nothing on your Reclaim List, you have no true lines.
//
// Those still return empty — the page must open — but they log, so the failure stops being invisible to us while
// being fully visible to the member. This test pins the ones we have ruled on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Reads whose empty result is a claim about the member, and the thing the member would wrongly conclude. */
const MUST_SPEAK: Array<[file: string, fn: string, lie: string]> = [
  ['app/playbook/[memberId]/actions.ts', 'loadPlaybookAction', 'you have kept nothing'],
  ['app/dashboard/checkin-actions.ts', 'loadCheckin', 'you have never spoken to your Companion'],
  ['app/checkpoint/[memberId]/[checkpointId]/checkpoint-actions.ts', 'reclaimForReconcile', 'your Reclaim List is empty'],
  ['app/rewire/actions.ts', 'loadTrueLines', 'you have no true lines'],
  ['app/rebuild/actions.ts', 'loadRebuildCeremonyKeepers', 'you kept nothing this phase'],
];

test('every read whose empty is a claim about the member logs when it fails', () => {
  const silent: string[] = [];
  for (const [file, fn, lie] of MUST_SPEAK) {
    const src = readFileSync(file, 'utf8');
    const at = src.indexOf(fn);
    assert.notEqual(at, -1, `${fn} not found in ${file} — was it renamed?`);
    // The body from the function to the next top-level declaration: enough to see its own catch.
    const body = src.slice(at, at + 2200);
    const catches = [...body.matchAll(/\}\s*catch\s*(\{|\()/g)];
    assert.ok(catches.length > 0, `${fn} no longer catches — update this list`);
    if (!/console\.(error|warn)/.test(body)) silent.push(`${file} · ${fn} — fails silently, and the member reads "${lie}"`);
  }
  assert.deepEqual(silent, [], `a read failure is invisible:\n${silent.join('\n')}`);
});

test('and they still DEGRADE rather than throw — the page must open', () => {
  // The fix must not trade a silent lie for a broken page. Each one still returns its empty value.
  for (const [file, fn] of MUST_SPEAK) {
    const src = readFileSync(file, 'utf8');
    const body = src.slice(src.indexOf(fn), src.indexOf(fn) + 2200);
    assert.ok(/return (\[\]|null)/.test(body), `${fn} should still degrade, not throw`);
  }
});
