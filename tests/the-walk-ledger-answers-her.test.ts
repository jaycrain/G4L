// A TESTER'S ITEM MUST NEVER GO SILENTLY MISSING.
//
// Two failures on 2026-08-30, neither a bug: Donna's button-ring request was DECLINED in August with the reason
// written in a CSS comment she will never read, and her Reclaim copy was SHIPPED on the 28th with nothing telling
// her so. She re-sent both. From where she sits those are the same event — she reports something, and the product
// does not visibly respond.
//
// The ledger derives the disposition from the repository so it cannot drift from what actually happened. These
// tests pin its three paths, because a reporting tool whose DECLINED branch has never fired is exactly the defect
// class this repo keeps finding: a rule that exists and does not run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { writeFileSync, rmSync, readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const run = (file: string) => execSync(`node scripts/walk-ledger.mjs ${file}`, { cwd: ROOT, encoding: 'utf8' });
const withItems = (body: string, fn: (f: string) => void) => {
  const f = 'docs/walks/_test-tmp.md';
  writeFileSync(`${ROOT}${f}`, body);
  try { fn(f); } finally { rmSync(`${ROOT}${f}`, { force: true }); }
};

test('SHIPPED — an item quoted in a commit reports its version', () => {
  withItems('- [t1] cut the phrase — key: building towards 100\n', (f) => {
    const out = run(f);
    assert.match(out, /SHIPPED \(1\)/);
    assert.match(out, /v3\.5\.6\d/, 'the version it shipped in, not just "done"');
  });
});

test('SHIPPED — a quote in the SOURCE counts too, when the commit paraphrased', () => {
  // The tool's first run called this OPEN an hour after shipping it, because the CSS comment quoted her and the
  // commit did not. Evidence that only counts in one location is a formatting rule, not evidence.
  withItems('- [t2] halve it — key: Reduce sunrise image 50%\n', (f) => {
    assert.match(run(f), /SHIPPED \(1\)/);
  });
});

test('OPEN — an item nothing in the repo answers is reported as unanswered', () => {
  withItems('- [t3] a thing nobody has done — key: zzz-no-such-phrase-anywhere-zzz\n', (f) => {
    const out = run(f);
    assert.match(out, /OPEN \(1\)/);
    assert.match(out, /unanswered, or answered without quoting her/);
  });
});

test('DECLINED — a refusal written in a comment is surfaced WITH where the reason lives', () => {
  // The branch that matters most: the failure being fixed is a decline she was never shown. If this path stops
  // working, the ledger silently reverts to the behaviour that caused the problem.
  const css = 'app/globals.css';
  const marker = 'walk-ledger self-check: deliberately NOT done — zzz-declined-probe-zzz';
  const original = readFileSync(`${ROOT}${css}`, 'utf8');
  try {
    writeFileSync(`${ROOT}${css}`, `${original}\n/* ${marker} */\n`);
    withItems('- [t4] a refused thing — key: zzz-declined-probe-zzz\n', (f) => {
      const out = run(f);
      assert.match(out, /DECLINED \(1\)/);
      assert.match(out, /globals\.css:\d+/, 'it names the file and line where the reason is written');
    });
  } finally {
    writeFileSync(`${ROOT}${css}`, original);
  }
});
