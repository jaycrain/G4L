import test from 'node:test';
import assert from 'node:assert/strict';
import { commitKeeper } from '../lib/agent/harvest.ts';

// THE BUG THIS HOLDS: on 2026-08-17 the science keeper committed fine locally and FAILED SILENTLY ON PROD, while
// the card had already told the member "we'll keep the takeaway in your Playbook."
//
// Cause: `keeperType` became optional so a science read could commit without one — the only way to reach the `why`
// chapter (chapterKey switches on keeper_type first). Every other caller passes a value, so this was the first
// `undefined` ever handed to that query. undefined is not a parameter value: PGlite coerced it, prod's driver did
// not. It worked everywhere except where it mattered — the same shape as the 7/27 harvest drop.
//
// A driver difference cannot be reproduced in a unit test, so this asserts the thing that IS testable and is what
// actually broke: no parameter reaching the database is ever `undefined`. That is a property worth holding for
// every column, not just this one.

function captureDb() {
  const calls: { sql: string; params: unknown[] }[] = [];
  return {
    calls,
    db: { query: async (sql: string, params: unknown[] = []) => { calls.push({ sql, params }); return { rows: [] }; } } as never,
  };
}

test('an absent keeperType reaches the driver as null, never undefined', async () => {
  const { db, calls } = captureDb();
  await commitKeeper(db, 'member-1', {
    momentId: '00000000-0000-4000-8000-000000000000',
    section: 'why_works',
    body: 'Why the reasonable-sounding lines are the ones that cost you',
    state: 'kept',
    source: { kind: 'science', ref: 'w1', label: 'Disinformation Audit · Rewire' },
  });
  const insert = calls.find((c) => /insert into playbook_entry/i.test(c.sql));
  assert.ok(insert, 'it should have attempted the insert');
  assert.ok(
    !insert!.params.includes(undefined),
    `no parameter may be undefined — got: ${JSON.stringify(insert!.params.map((p) => (p === undefined ? 'UNDEFINED' : p)))}`,
  );
});

test('a keeper with no source still passes nulls rather than undefined', async () => {
  // source is optional too, and its three columns take the same path.
  const { db, calls } = captureDb();
  await commitKeeper(db, 'member-1', {
    momentId: '00000000-0000-4000-8000-000000000000',
    keeperType: 'principle',
    section: 'own_words',
    body: 'A true line',
  });
  const insert = calls.find((c) => /insert into playbook_entry/i.test(c.sql));
  assert.ok(!insert!.params.includes(undefined), 'no parameter may be undefined');
});
