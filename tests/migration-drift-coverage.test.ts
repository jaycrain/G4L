import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { MIGRATIONS } from '../lib/db/schema.ts';
import { sql } from '../scripts/db/gen-migration-drift.mjs';

// THE DRIFT CHECK HAS TO COVER EVERY MIGRATION, OR IT IS WORSE THAN NOTHING.
//
// `gen-migration-drift.mjs` builds the "which migrations are missing on prod?" SQL from a HAND-MAINTAINED array.
// On 2026-08-08 that array was found to stop at 0055 while the repo had shipped through 0074 — nineteen
// migrations with no check at all. The generator still ran, still printed SQL, and still reported a clean
// database. A diagnostic that answers "no drift" while inspecting none of the recent work is a confident lie,
// and this one guards RLS on tables holding member material.
//
// The generator now DERIVES from lib/db/schema.ts's MIGRATIONS — the list applySchema already maintains — so the
// duplicate copy is gone. A sentinel still can't be derived from the file itself (it's a judgement: a table for a
// create, a column for an alter, an INVERTED check for 0068 which drops one), so this test guards the one list
// that remains: add a migration file without a schema.ts entry and the suite fails.

const MIGRATION_DIR = new URL('../supabase/migrations/', import.meta.url);

const numberOf = (file: string): string => file.split('/').pop()!.slice(0, 4);

function migrationNumbers(): string[] {
  return readdirSync(MIGRATION_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.slice(0, 4))
    .filter((n) => /^\d{4}$/.test(n))
    .sort();
}

test('every migration file has a drift-check sentinel', () => {
  const onDisk = migrationNumbers();
  const covered = new Set(MIGRATIONS.map((m) => numberOf(m.file)));
  const missing = onDisk.filter((n) => !covered.has(n));
  assert.deepEqual(
    missing,
    [],
    `Migrations with no entry in lib/db/schema.ts MIGRATIONS: ${missing.join(', ')}.\n` +
      "Add { file: 'migrations/NNNN_x.sql', sentinel: 'new_table' } (or {table,column}, or {sql} for a DROP).\n" +
      'Without it applySchema skips the migration AND the prod drift check reports it as fine.',
  );
});

test('the sentinel list has no entry for a migration that does not exist', () => {
  // The inverse drift: a renamed or deleted migration leaves a stale sentinel that can never be satisfied,
  // which reports permanent false drift and trains us to ignore the output.
  const onDisk = new Set(migrationNumbers());
  const stale = MIGRATIONS.map((m) => numberOf(m.file)).filter((n) => !onDisk.has(n));
  assert.deepEqual(stale, [], `Sentinels with no migration file: ${stale.join(', ')}`);
});

test('the list is unique and ordered — a duplicate number would mask one of the two', () => {
  const nums = MIGRATIONS.map((m) => numberOf(m.file));
  assert.equal(new Set(nums).size, nums.length, 'duplicate migration number in M');
  assert.deepEqual(nums, [...nums].sort(), 'MIGRATIONS is out of order — hard to scan, easy to double-add');
});

test("the DROP migration's sentinel is INVERTED in the generated SQL, not read backwards", () => {
  // 0068 drops member_session.token, so "applied" means the column is GONE. If this ever reads as a plain
  // existence check the SQL reports a migrated database as permanently behind — and a check that cries wolf is
  // one we learn to skip. Pinning the polarity because it is the single non-obvious entry in the list.
  // Its expression spans several lines (the raw-SQL sentinel is written multi-line in schema.ts), so take the
  // whole segment up to the next union rather than a single line — the first cut of this test read one line,
  // found no `column_name`, and failed on a correct generator.
  const start = sql.indexOf("'0068'");
  assert.ok(start > -1, '0068 missing from the generated drift SQL');
  const end = sql.indexOf('union all', start);
  const segment = sql.slice(start, end > -1 ? end : undefined);
  assert.match(segment, /not exists/, '0068 must be a NOT EXISTS — it is a DROP');
  assert.match(segment, /column_name = 'token'/, 'and it must name the dropped column');
});
