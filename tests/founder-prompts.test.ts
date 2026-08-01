import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { listSavedPrompts, savePrompt, unsavePrompt, __resetPromptCache } from '../lib/founder/prompts.ts';

const fresh = async (): Promise<Db> => {
  __resetPromptCache();
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  return db;
};

test('a starred question comes back, newest first', async () => {
  const db = await fresh();
  await savePrompt(db, 'Who is closest to a Checkpoint?');
  await savePrompt(db, 'Anyone drifting in Rebuild?');
  const saved = await listSavedPrompts(db);
  assert.equal(saved.length, 2);
  assert.equal(saved[0], 'Anyone drifting in Rebuild?', 'most recently starred leads');
});

test('starring twice is ONE pin', async () => {
  const db = await fresh();
  await savePrompt(db, 'Run my morning scan');
  await savePrompt(db, 'Run my morning scan');
  assert.equal((await listSavedPrompts(db)).length, 1);
});

test('the shortlist stays short — oldest drop off past the cap', async () => {
  // A pin row you have to read is not a shortcut. Past ~8 it stops being scannable and starts being an archive.
  const db = await fresh();
  for (let i = 0; i < 11; i++) await savePrompt(db, `question ${i}`);
  const saved = await listSavedPrompts(db);
  assert.equal(saved.length, 8);
  assert.ok(!saved.includes('question 0'), 'the oldest is gone, not the newest');
  assert.ok(saved.includes('question 10'));
});

test('unstarring removes it', async () => {
  const db = await fresh();
  await savePrompt(db, 'What moved overnight?');
  await unsavePrompt(db, 'What moved overnight?');
  assert.deepEqual(await listSavedPrompts(db), []);
});

test('BEFORE the migration: saving no-ops, listing is empty, nothing throws', async () => {
  // Hand-applied migrations mean code and schema never land together. The defaults must still work in the gap.
  __resetPromptCache();
  const db = new PGlite() as unknown as Db;
  await applySchema(db);
  await db.query('drop table if exists founder_prompt');
  await assert.doesNotReject(() => savePrompt(db, 'x'));
  assert.deepEqual(await listSavedPrompts(db), []);
});
