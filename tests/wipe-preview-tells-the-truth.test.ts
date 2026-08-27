// THE PREVIEW MUST NAME THE SAME SURVIVORS AS THE DELETE.
//
// scripts/db/wipe-except.sql carries its keep-list TWICE — once in the Step 1 preview and once in the Step 2 DO
// block — because the preview has to be runnable on its own in the SQL Editor. That is a `one fact, two sites`
// arrangement in the most expensive place we have: a mismatch means the preview shows a person as KEEP and the
// delete removes them, which is worse than shipping no preview at all, because it converts a safety step into
// false reassurance.
//
// A comment asking the next person to edit both is not a guarantee. This is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SQL = readFileSync(new URL('../scripts/db/wipe-except.sql', import.meta.url), 'utf8');

/** Quoted addresses inside a named region of the file. */
function addressesIn(startRe: RegExp, endRe: RegExp): string[] {
  const from = SQL.search(startRe);
  assert.notEqual(from, -1, `region not found: ${startRe}`);
  const rest = SQL.slice(from);
  const to = rest.search(endRe);
  assert.notEqual(to, -1, `region end not found: ${endRe}`);
  return [...rest.slice(0, to).matchAll(/'([^']+@[^']+)'/g)].map((m) => m[1]!.toLowerCase()).sort();
}

test('the Step 1 preview and the Step 2 delete keep exactly the same accounts', () => {
  const preview = addressesIn(/with keep as \(/, /\]\)\)/);
  const wipe = addressesIn(/keep text\[\] := array\[/, /\];/);
  assert.ok(preview.length > 0, 'the preview keep-list is empty — that would mark every account for deletion');
  assert.deepEqual(wipe, preview, 'preview and delete disagree about who survives');
});

// The tooling dependencies. Each of these is something that breaks quietly, not loudly, if the account is gone.
test('the accounts our own tooling logs in as are never on the chopping block', () => {
  const keep = addressesIn(/keep text\[\] := array\[/, /\];/);
  // SMOKE_EMAIL — scripts/smoke.ts is the post-deploy gate and refuses non-.test accounts.
  assert.ok(keep.includes('demo-tom@grintaforlife.test'), 'wiping SMOKE_EMAIL kills the post-deploy smoke test');
  // /admin/fresh — the only route to the Threshold ceremony, the Opening Tour and every empty state.
  assert.ok(keep.includes('fresh@grintaforlife.test'), 'wiping the fresh account hides every first-run surface');
  // The personas that have a PAST. Without one, every history-conditional surface renders as nothing and a walk
  // passes straight over it.
  assert.ok(
    keep.includes('demo-maria@grintaforlife.test') && keep.includes('demo-reshma@grintaforlife.test'),
    'the seeded far-along personas are how we see history-conditional surfaces at all',
  );
});

test('gdc@gdc.com is not treated as Greg — it is a deletion target in the sibling script', () => {
  const keep = addressesIn(/keep text\[\] := array\[/, /\];/);
  assert.ok(!keep.includes('gdc@gdc.com'), 'gdc@gdc.com is a test account, not Greg');
  assert.ok(keep.includes('gjwg4l1@gmail.com'), "Greg's real address must be on the keep-list");
});

// Greg is the ONLY real person kept. Everything else is a demo account our tooling drives. Pinned because the
// list grew a person once already on an unchecked assumption ("her open findings need her state" — they do not),
// and a keep-list is the one place where a plausible-sounding addition costs nothing to add and everything to be
// wrong about: it silently preserves member data a wipe was meant to clear.
test('exactly one real address survives, and it is Greg', () => {
  const keep = addressesIn(/keep text\[\] := array\[/, /\];/);
  const real = keep.filter((e) => !e.endsWith('.test'));
  assert.deepEqual(real, ['gjwg4l1@gmail.com'], `expected only Greg; got ${real.join(', ') || '(none)'}`);
});
