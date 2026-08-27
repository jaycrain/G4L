// EVERY COPY OF THE KEEP-LIST MUST NAME THE SAME SURVIVORS.
//
// scripts/db/wipe-except.sql carries its keep-list more than once — the Step 1 preview, the Step 1b
// matches-nothing check, and the Step 2 delete — because each has to be runnable on its own in the SQL Editor.
// That is a `one fact, N sites` arrangement in the most expensive place we have: if the preview and the delete
// disagree, the preview shows a person as KEEP and the delete removes them. That is worse than shipping no
// preview at all, because it converts a safety step into false reassurance.
//
// The count is deliberately NOT hardcoded. It went from two to three the moment 1b was added, and a test that
// knows how many copies to expect would have to be edited by the same person who just forgot to edit one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SQL = readFileSync(new URL('../scripts/db/wipe-except.sql', import.meta.url), 'utf8');

/** Every `array[ … ]` literal in the file that contains email addresses, as a sorted lowercase list. */
function keepLists(): string[][] {
  const out: string[][] = [];
  for (const m of SQL.matchAll(/array\[([\s\S]*?)\]/g)) {
    const emails = [...m[1]!.matchAll(/'([^']+@[^']+)'/g)].map((e) => e[1]!.toLowerCase());
    if (emails.length) out.push(emails.sort());
  }
  return out;
}

test('every keep-list in the file names exactly the same accounts', () => {
  const lists = keepLists();
  assert.ok(lists.length >= 2, `expected the list to appear at least twice; found ${lists.length}`);
  for (let i = 1; i < lists.length; i++) {
    assert.deepEqual(lists[i], lists[0], `keep-list copy #${i + 1} disagrees with the first about who survives`);
  }
});

// The tooling dependencies. Each breaks quietly, not loudly, if the account is gone.
test('the accounts our own tooling logs in as are never on the chopping block', () => {
  const keep = keepLists()[0]!;
  // SMOKE_EMAIL — scripts/smoke.ts is the post-deploy gate and refuses non-.test accounts.
  assert.ok(keep.includes('demo-tom@grintaforlife.test'), 'wiping SMOKE_EMAIL kills the post-deploy smoke test');
  // /admin/fresh — the only route to the Threshold ceremony, the Opening Tour and every empty state.
  assert.ok(keep.includes('fresh@grintaforlife.test'), 'wiping the fresh account hides every first-run surface');
});

// THE ONE THAT IS NOT A PERSON. connect_post.author_id is NOT NULL, references member_profile, and cascades on
// delete — so removing "The Founders" takes every post signed by it, including the seeded Session topics. It was
// in the DELETE list on the 8/27 run and was caught with one paste to spare, purely because someone read the
// list. Nothing about the row looks like infrastructure: it has a display name and sits among the members.
test('the Founders authoring identity is never wiped — it is infrastructure wearing a display name', () => {
  const keep = keepLists()[0]!;
  assert.ok(
    keep.includes('founders@system.grintaforlife.internal'),
    'deleting The Founders cascades to every Community post signed by it',
  );
});

test('gdc@gdc.com is not treated as Greg — it is a deletion target in the sibling script', () => {
  const keep = keepLists()[0]!;
  assert.ok(!keep.includes('gdc@gdc.com'), 'gdc@gdc.com is a test account, not Greg');
  assert.ok(keep.includes('gjwg4l1@gmail.com'), "Greg's real address must be on the keep-list");
});

// Greg is the ONLY real person kept. Everything else is a demo account our tooling drives. Pinned because the
// list grew a person once already on an unchecked assumption ("her open findings need her state" — they do not),
// and a keep-list is the one place where a plausible-sounding addition costs nothing to add and everything to be
// wrong about: it silently preserves member data a wipe was meant to clear.
test('exactly one real PERSON survives, and it is Greg', () => {
  const human = keepLists()[0]!
    .filter((e) => !e.endsWith('.test'))                       // demo accounts
    .filter((e) => !e.endsWith('.internal'));                  // system identities
  assert.deepEqual(human, ['gjwg4l1@gmail.com'], `expected only Greg; got ${human.join(', ') || '(none)'}`);
});
