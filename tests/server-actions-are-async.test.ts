// A 'use server' FILE MAY ONLY EXPORT ASYNC FUNCTIONS.
//
// Next.js enforces this at compile time, not through the type system — so `tsc --noEmit` is clean, every unit
// test passes, and the module still fails to build the moment a real request touches it. The whole file dies,
// taking every route that imports it.
//
// It cost a live break on 2026-08-28: splitting Reconnect into Sessions added `export const reconnectArcFor =
// (session) => …` to app/reconnect/actions.ts — a synchronous helper, correctly typed, fully covered by tests
// that import the arcs directly. Every workspace route 500'd with "Server Actions must be async functions", and
// nothing in 2,300 green tests said a word. It surfaced only because the routes were opened in a browser.
//
// A TYPE EXPORT IS FINE — the constraint is on values, not types. That distinction is the reason this can't be a
// blanket "no non-function exports" rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = new URL('../app/', import.meta.url).pathname;

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return tsFiles(p);
    return p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : [];
  });
}

test("every export in a 'use server' file is an async function", () => {
  const offenders: string[] = [];
  let checked = 0;

  for (const file of tsFiles(APP)) {
    const src = readFileSync(file, 'utf8');
    // The directive must be the first statement for the file to be a server module.
    if (!/^\s*(['"])use server\1/m.test(src.slice(0, 200))) continue;
    checked++;
    const rel = file.slice(APP.length);

    for (const m of src.matchAll(/^export\s+(?!type\b|interface\b)([^\n]*)/gm)) {
      const decl = m[1]!.trim();
      // `export async function x(` is the only legal value export. `export {}` re-exports are not used here and
      // would need their own handling if they ever are.
      if (/^async function\s/.test(decl)) continue;
      offenders.push(`${rel} — export ${decl.slice(0, 70)}`);
    }
  }

  assert.ok(checked >= 3, `expected to find the server-action files; inspected ${checked}`);
  assert.deepEqual(
    offenders,
    [],
    "a 'use server' file may only export async functions (types are fine) — anything else fails the BUILD, " +
      `not the typecheck, and takes every route importing it down:\n  ${offenders.join('\n  ')}`,
  );
});
