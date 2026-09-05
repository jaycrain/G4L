// LATEST HAS TWO AUDIENCES AND MUST NOT BREAK EITHER.
//
// Machines: `canon-drift` regexes it from the start of the file, `sync-canon-mount` and the integrity test take
// its first whitespace-delimited token. Humans: Cowork opens it to answer "is this member on the current build?"
//
// Those two needs pull opposite ways, which is why this test exists. On 2026-09-04 the file held ONLY the
// machine line — a version and a commit — and the commit is one a member can never see: publishing the bundle is
// itself a commit, and that commit is what deploys. Cowork lost time to the mismatch, and then CC repeated it in
// writing, telling Greg to compare his footer against that sha. The prose that now prevents it is the part a
// parser must tolerate, and the parseable line is the part a rewrite must not lose.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LATEST = join('docs', 'canon', 'LATEST');
const raw = (): string => readFileSync(LATEST, 'utf8');

test('LATEST still parses for canon-drift — anchored version + commit', () => {
  if (!existsSync(LATEST)) return; // nothing published yet
  // The EXACT expression from scripts/canon-drift.mjs. Copied deliberately: if that regex changes, this fails
  // and someone has to look at both, which is the point.
  const m = raw().trim().match(/^(v[\d.]+)\s*·\s*app @\s*([0-9a-f]+)/i);
  assert.ok(m, 'canon-drift could not parse LATEST — the drift gate would exit 2 on every run');
  assert.match(m![1]!, /^v\d+\.\d+/, 'the version must lead the file');
  assert.ok(m![2]!.length >= 7, 'the commit must be a usable sha');
});

test('LATEST still yields the version as its first token — sync + integrity both rely on it', () => {
  if (!existsSync(LATEST)) return;
  // scripts/sync-canon-mount.mjs uses split(/\s/)[0]; tests/canon-integrity.test.ts uses split(/\s+/)[0].
  assert.equal(raw().trim().split(/\s/)[0], raw().trim().split(/\s+/)[0], 'the two splits must agree');
  assert.match(raw().trim().split(/\s/)[0]!, /^v\d+\.\d+/, 'first token must be the version');
});

test('LATEST tells a human to compare the VERSION, not the commit', () => {
  if (!existsSync(LATEST)) return;
  const text = raw();
  assert.match(text, /VERSION/, 'the file must name the version as the thing to compare');
  assert.match(
    text,
    /never show|can never|will\s+\n?therefore never show/i,
    'it must say plainly that a member cannot see this commit — the omission that cost a morning',
  );
});

test('the prose lives BELOW the parseable line, never beside it', () => {
  if (!existsSync(LATEST)) return;
  const first = raw().split('\n')[0]!;
  // If explanation ever creeps onto line 1, the anchored regex still matches but sync-canon-mount's first-token
  // split could pick up something else. Keep line 1 to exactly the two facts a machine reads.
  assert.match(first, /^v[\d.]+ · app @ [0-9a-f]+$/, `line 1 must be only "vX.Y.Z · app @ <sha>", got: ${first}`);
});
