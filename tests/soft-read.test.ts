// A FAILED READ MUST NOT LOOK LIKE AN EMPTY ONE.
//
// `catch(() => [])` keeps a dashboard up when a query throws — right — but it erases the difference between "this
// member logged nothing" and "the query broke", and the UI renders both as the same blank panel. The member is then
// told, confidently, that their work isn't there.
//
// Greg logged a Good Call on 2026-08-06 and it "didn't show up as a positive." Six read sites for Momentum alone
// swallowed their errors into `[]`, so from the outside there was no way to tell whether the write failed, the read
// failed, or he really had no calls. Fourth time this shape has cost a debugging session.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { softRead } from '../lib/db/degrade.ts';

test('a healthy read returns its value untouched', async () => {
  const rows = [{ type: 'good_call' }];
  assert.deepEqual(await softRead('t.ok', 'm1', async () => rows, []), rows);
});

test('a FAILING read still degrades — the page must not go down', async () => {
  const errs: string[] = [];
  const orig = console.error;
  console.error = (m?: unknown) => { errs.push(String(m)); };
  try {
    const out = await softRead('momentum.pulseBeats', 'm1', async () => { throw new Error('column "domain" does not exist'); }, []);
    assert.deepEqual(out, [], 'falls back so the panel renders empty rather than 500ing');
  } finally {
    console.error = orig;
  }
  // …BUT IT SAYS SO. This is the whole point: the blank panel is now explainable from the server log.
  assert.equal(errs.length, 1);
  assert.match(errs[0]!, /momentum\.pulseBeats/, 'names the read, so it can be grepped');
  assert.match(errs[0]!, /m1/, 'names the member, so one report can be traced');
  assert.match(errs[0]!, /column "domain" does not exist/, 'carries the REAL cause, not a generic message');
});

test('the fallback can be any shape, not just an array', async () => {
  const orig = console.error;
  console.error = () => {};
  try {
    assert.equal(await softRead('t.null', 'm1', async () => { throw new Error('x'); }, null), null);
    assert.deepEqual(await softRead('t.obj', 'm1', async () => { throw new Error('x'); }, {} as Record<string, string>), {});
  } finally {
    console.error = orig;
  }
});

test('a broken logger never becomes a broken page', async () => {
  const orig = console.error;
  console.error = () => { throw new Error('logger itself is down'); };
  try {
    assert.deepEqual(await softRead('t.logfail', 'm1', async () => { throw new Error('read failed'); }, []), []);
  } finally {
    console.error = orig;
  }
});

test('a non-Error throw is still reported', async () => {
  const errs: string[] = [];
  const orig = console.error;
  console.error = (m?: unknown) => { errs.push(String(m)); };
  try {
    await softRead('t.weird', 'm1', async () => { throw 'just a string'; }, []);
  } finally {
    console.error = orig;
  }
  assert.match(errs[0]!, /just a string/);
});
