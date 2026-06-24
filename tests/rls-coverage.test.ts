import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// RLS COVERAGE GUARD
//
// The bug this prevents (Jun 2026): 0013 enabled RLS on every public table that existed THEN via a
// one-time loop, but its comment wrongly claimed it covered future tables. A table created later that
// forgot `enable row level security` (system_health, 0034) was left readable/writable by the Data API
// (PostgREST anon role) — Supabase's rls_disabled_in_public advisory. 0039 re-swept to fix it.
//
// This guard makes the recurrence impossible to merge: every non-sentinel table created AFTER the most
// recent RLS *sweep* migration must explicitly `enable row level security` in its own migration. Tables
// at/before a sweep are covered by that sweep's loop. Sentinel/internal tables (names starting with `_`)
// are exempt — they hold no member data and gate the migration runner.
//
// Posture reminder: RLS-on + no-policy = default-deny for the Data API roles; the app's table-OWNER
// connection bypasses RLS, so this never affects the app. Do NOT "fix" a failure by adding a policy —
// add `alter table <t> enable row level security;` to the new table's migration (or a fresh sweep).

const DIR = join(process.cwd(), 'supabase', 'migrations');

function migrationNum(file: string): number {
  return Number(file.slice(0, 4));
}

test('every public table created after the last RLS sweep enables RLS', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

  const createdAt = new Map<string, number>(); // table -> first migration number that creates it
  const rlsEnabled = new Set<string>(); // tables with an explicit `enable row level security`
  const sweepNums: number[] = []; // migrations that run the pg_tables enable-RLS loop

  for (const file of files) {
    const num = migrationNum(file);
    // Strip line comments so prose like "every CREATE TABLE migration must…" isn't parsed as DDL.
    const sql = readFileSync(join(DIR, file), 'utf8').replace(/--[^\n]*/g, '');

    for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?["']?(\w+)/gi)) {
      const t = m[1]!.toLowerCase();
      if (!createdAt.has(t)) createdAt.set(t, num);
    }
    for (const m of sql.matchAll(/alter table\s+(?:public\.)?["']?(\w+)["']?\s+enable row level security/gi)) {
      rlsEnabled.add(m[1]!.toLowerCase());
    }
    // A "sweep" = a loop over pg_tables that enables RLS (covers everything existing at that point).
    if (/pg_tables[\s\S]{0,400}enable row level security/i.test(sql)) sweepNums.push(num);
  }

  assert.ok(sweepNums.length > 0, 'expected at least one RLS sweep migration (0013 / 0039)');
  const lastSweep = Math.max(...sweepNums);

  const exposed: string[] = [];
  for (const [table, num] of createdAt) {
    if (table.startsWith('_')) continue; // sentinel / internal
    if (num <= lastSweep) continue; // covered by a sweep loop
    if (!rlsEnabled.has(table)) exposed.push(`${table} (created in ${num}, no RLS)`);
  }

  assert.deepEqual(
    exposed,
    [],
    `Tables created after the last RLS sweep (${lastSweep}) without RLS — add ` +
      `\`alter table <t> enable row level security;\` to their migration:\n  ${exposed.join('\n  ')}`,
  );
});
