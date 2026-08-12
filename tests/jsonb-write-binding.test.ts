import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A BOUND jsonb PARAMETER MUST GO THROUGH ::text FIRST.
//
// Measured on prod 2026-08-12, not reasoned about — the two previous attempts to reason about this shape both
// produced confident wrong answers. Three read-only probes, the exact patterns our writes use:
//
//   select jsonb_typeof($1::jsonb)         with JSON.stringify(obj)  ->  "string"   ← every write we had
//   select jsonb_typeof($1::text::jsonb)   with JSON.stringify(obj)  ->  "object"   ← the fix
//   select jsonb_typeof(to_jsonb($1::text))                          ->  "string"   ← control, as expected
//
// `$n::jsonb` resolves the PARAMETER's type to jsonb, so postgres.js serialises the value it was handed — and the
// value is already a JSON string, so it is encoded twice and lands as a jsonb scalar string. `::text` first pins
// the parameter to text, and Postgres's own cast parses it once.
//
// PGlite does not reproduce this, which is why nothing local ever caught it and why this guard is a SOURCE check
// rather than a behavioural one. A test that cannot fail on the machine you run it on is worth writing only if it
// reads the code instead of the behaviour.

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

test('no bound parameter is cast straight to jsonb — it double-encodes on hosted Postgres', () => {
  const offenders: string[] = [];
  for (const f of [...walk('lib'), ...walk('app')]) {
    // The diagnostic's binding probe deliberately runs BOTH forms; that is the measurement, not a write.
    if (f.endsWith(join('lib', 'admin', 'diagnostic.ts'))) continue;
    for (const [i, line] of readFileSync(f, 'utf8').split('\n').entries()) {
      if (/\$\d+::jsonb/.test(line) && !/\$\d+::text::jsonb/.test(line)) {
        offenders.push(`${f}:${i + 1} — ${line.trim().slice(0, 100)}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `bind through ::text::jsonb, or the value lands as a jsonb string:\n${offenders.join('\n')}`,
  );
});
