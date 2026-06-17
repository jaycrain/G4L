import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Regression guard for the Jun-2026 naming sweep (patterns, not patches): the retired Book Quiz
// (`BKQ`) and the old "Fade Door" label must NOT reappear anywhere in the code homes — beats,
// reflections, prompts, engine, UI. If either resurfaces, this fails and names the file:line, so
// the debt can't quietly come back in any of its homes.
//
// Scope: lib/ + app/ source (+ this file is excluded). Docs are intentionally allowed to reference
// the old terms historically (the open-issues / flow write-ups), so they're not scanned.
const BANNED: { re: RegExp; why: string }[] = [
  { re: /Fade Doors?/i, why: 'use "the Doors" — the "Fade Door(s)" label is retired (member-facing AND internal)' },
  { re: /\bBKQ\b/, why: 'the Book Quiz (RCN-BKQ) is retired — no beat/reflection/id should reference it' },
];

const ROOTS = ['lib', 'app'];
const EXTS = new Set(['.ts', '.tsx', '.json', '.sql']);
const SELF = 'naming-guard.test.ts';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (EXTS.has(p.slice(p.lastIndexOf('.'))) && !p.endsWith(SELF)) out.push(p);
  }
  return out;
}

test('retired terms (Fade Door / BKQ) never reappear in lib or app', () => {
  const offenders: string[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const { re, why } of BANNED) {
          if (re.test(line)) offenders.push(`${file}:${i + 1} — ${re} (${why})\n    ${line.trim().slice(0, 120)}`);
        }
      });
    }
  }
  assert.equal(offenders.length, 0, `Retired naming resurfaced:\n${offenders.join('\n')}`);
});
