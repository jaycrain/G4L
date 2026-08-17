import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// DOES THE PUBLISHED CANON STILL MATCH ITS OWN MANIFEST?
//
// WHY THIS EXISTS. On 2026-08-17 I published v3.4.9, then appended a caveat paragraph to sync-note.md — after
// publish-canon.mjs had already hashed it. The bundle shipped self-inconsistent, and COWORK found it, not us:
// she ran the MANIFEST's own verification rule, stopped before touching the glossary, and asked us to re-hash.
//
// She handled it exactly right, and the check did its job. But the manifest is a promise we make to someone
// downstream, and the first person to test that promise should not be the person relying on it. The failure is
// also completely silent locally — every file is present and readable, the folder lists correctly, and nothing
// errors. It only shows up if something recomputes the hashes.
//
// So: recompute them here. This runs on the LATEST canon version, because that is the one Cowork is reading.
// A stale hash on an old version is history; a stale hash on the current one is a live problem.

const CANON = 'docs/canon';

function latestVersion(): string | null {
  const p = join(CANON, 'LATEST');
  if (!existsSync(p)) return null;
  // "v3.4.9 · app @ 4f37844"
  return readFileSync(p, 'utf8').trim().split(/\s+/)[0] ?? null;
}

test('the LATEST published canon matches its own MANIFEST hashes', () => {
  const v = latestVersion();
  if (!v) return; // nothing published yet — not a failure
  const dir = join(CANON, v);
  const manifestPath = join(dir, 'MANIFEST.md');
  if (!existsSync(manifestPath)) return;

  const manifest = readFileSync(manifestPath, 'utf8');
  // | `part.md` | 12,345 | `abcdef0123456789` | description |
  const rows = [...manifest.matchAll(/^\|\s*`([^`]+)`\s*\|\s*([\d,]+)\s*\|\s*`([0-9a-f]{16})`/gm)];
  assert.ok(rows.length >= 4, `MANIFEST for ${v} lists ${rows.length} parts — expected the full set`);

  const bad: string[] = [];
  for (const [, file, bytesStr, sha16] of rows) {
    const p = join(dir, file!);
    if (!existsSync(p)) { bad.push(`${file} — MISSING, but the manifest promises it`); continue; }
    const buf = readFileSync(p);
    const actualSha = createHash('sha256').update(buf).digest('hex').slice(0, 16);
    const actualBytes = buf.length;
    const wantBytes = Number((bytesStr ?? '').replace(/,/g, ''));
    if (actualSha !== sha16) {
      bad.push(`${file} — sha ${actualSha} but manifest says ${sha16} (${actualBytes} bytes vs ${wantBytes})`);
    }
  }

  assert.deepEqual(bad, [],
    `Published canon ${v} does not match its MANIFEST. Someone edited a part after publish-canon.mjs hashed it.\n` +
    `Fix: re-run \`node scripts/publish-canon.mjs ${v.replace(/^v/, '')}\`, then commit and \`npm run canon:sync\`.\n` +
    bad.join('\n'));
});

test('every part the MANIFEST promises is non-empty — an empty file is the failure that looks like success', () => {
  // The Drive-era failure this whole system replaced: the folder listed, the manifest promised, and the member
  // transcript was empty. Git removed the partial-state problem, but "present" is still not "populated".
  const v = latestVersion();
  if (!v) return;
  const dir = join(CANON, v);
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    if (f === 'screenshots') continue;
    const buf = readFileSync(join(dir, f));
    assert.ok(buf.length > 0, `${v}/${f} is EMPTY`);
  }
});
