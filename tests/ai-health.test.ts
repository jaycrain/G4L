import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { classifyAiError } from '../lib/health/ai.ts';
import { getHealth, recordHealth } from '../lib/health/store.ts';

test('classifyAiError: usage cap (the Donna outage) → usage_limit + regain date', () => {
  const r = classifyAiError({
    status: 400,
    message:
      'Error - 400 {"type":"error","error":{"type":"invalid_request_error","message":"You have reached your specified API usage limits. You will regain access on 2026-07-01 at 00:00 UTC."}}',
  });
  assert.equal(r.status, 'usage_limit');
  assert.match(r.detail, /2026-07-01/);
});

test('classifyAiError: 401/403 → auth', () => {
  assert.equal(classifyAiError({ status: 401, message: 'unauthorized' }).status, 'auth');
  assert.equal(classifyAiError({ status: 403, message: 'forbidden' }).status, 'auth');
});

test('classifyAiError: 429/529 → overloaded', () => {
  assert.equal(classifyAiError({ status: 429, message: 'rate limit' }).status, 'overloaded');
  assert.equal(classifyAiError({ status: 529, message: 'overloaded' }).status, 'overloaded');
});

test('classifyAiError: anything else → down (truncated detail)', () => {
  const r = classifyAiError({ status: 500, message: 'x'.repeat(500) });
  assert.equal(r.status, 'down');
  assert.ok(r.detail.length <= 200);
});

test('classifyAiError: a 400 that is NOT a usage cap → down, not usage_limit', () => {
  assert.equal(classifyAiError({ status: 400, message: 'invalid model' }).status, 'down');
});

test('recordHealth returns the PRIOR row (drives ok<->down transition detection)', async () => {
  const db = new PGlite() as unknown as Db;
  await applySchema(db);

  const first = await recordHealth(db, 'ai', { status: 'ok', detail: 'fine', latencyMs: 100, model: 'm' });
  assert.equal(first, null); // nothing before the first write

  const prev = await recordHealth(db, 'ai', { status: 'usage_limit', detail: 'capped', latencyMs: null, model: 'm' });
  assert.equal(prev?.status, 'ok'); // sees the previous OK → caller would alert "down"

  const now = await getHealth(db, 'ai');
  assert.equal(now?.status, 'usage_limit'); // latest persisted
});
