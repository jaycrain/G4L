import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { M } from '../scripts/db/gen-migration-drift.mjs';

// THE DRIFT CHECK HAS TO COVER EVERY MIGRATION, OR IT IS WORSE THAN NOTHING.
//
// `gen-migration-drift.mjs` builds the "which migrations are missing on prod?" SQL from a HAND-MAINTAINED array.
// On 2026-08-08 that array was found to stop at 0055 while the repo had shipped through 0074 — nineteen
// migrations with no check at all. The generator still ran, still printed SQL, and still reported a clean
// database. A diagnostic that answers "no drift" while inspecting none of the recent work is a confident lie,
// and this one guards RLS on tables holding member material.
//
// The list can't be derived from the files (a sentinel is a judgement — a table for a create, a column for an
// alter, an INVERTED check for 0068 which drops one). So it stays hand-written, and this test makes forgetting
// it impossible: add a migration without an entry here and the suite fails.

const MIGRATION_DIR = new URL('../supabase/migrations/', import.meta.url);

function migrationNumbers(): string[] {
  return readdirSync(MIGRATION_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.slice(0, 4))
    .filter((n) => /^\d{4}$/.test(n))
    .sort();
}

test('every migration file has a drift-check sentinel', () => {
  const onDisk = migrationNumbers();
  const covered = new Set((M as [string, unknown][]).map(([n]) => n));
  const missing = onDisk.filter((n) => !covered.has(n));
  assert.deepEqual(
    missing,
    [],
    `Migrations with no entry in gen-migration-drift.mjs: ${missing.join(', ')}.\n` +
      'Add ["NNNN", { t: "new_table" }] (or { c: ["table","column"] }, or { s: "raw sql" }) to M.\n' +
      'Without it the prod drift check silently reports these as fine.',
  );
});

test('the sentinel list has no entry for a migration that does not exist', () => {
  // The inverse drift: a renamed or deleted migration leaves a stale sentinel that can never be satisfied,
  // which reports permanent false drift and trains us to ignore the output.
  const onDisk = new Set(migrationNumbers());
  const stale = (M as [string, unknown][]).map(([n]) => n).filter((n) => !onDisk.has(n));
  assert.deepEqual(stale, [], `Sentinels with no migration file: ${stale.join(', ')}`);
});

test('the list is unique and ordered — a duplicate number would mask one of the two', () => {
  const nums = (M as [string, unknown][]).map(([n]) => n);
  assert.equal(new Set(nums).size, nums.length, 'duplicate migration number in M');
  assert.deepEqual(nums, [...nums].sort(), 'M is out of order — hard to scan, easy to double-add');
});
