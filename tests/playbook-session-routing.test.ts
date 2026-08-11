import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tabFor, chapterKey, TAB_FOR_CHAPTER } from '../lib/playbook/tabs.ts';

// ARE THE SESSIONS ACTUALLY HOOKED UP TO THE PLAYBOOK?
//
// The question Jay asks before every walk, and until now the answer was "I read the code and think so". The tabs
// moved twice in one week; a mapping that is only ever verified by reading is a mapping that drifts.
//
// The chain being pinned: a Session commits a keeper with a keeperType -> chapterKey() -> TAB_FOR_CHAPTER -> tab.

test('SESSION OUTPUT LANDS WHERE THE MEMBER IS TOLD TO LOOK', () => {
  // Each row is a real emit point in the app, not a hypothetical.
  const routes: [string, string, string][] = [
    ['onboarding · the identity they named', 'definition', 'learned'],
    ['Reconnect §2b · a Door re-seeing', 'tell', 'learned'],
    ['Rebuild B3 · the Lifestyle Pilot', 'plan', 'worked'],
    ['any practice week, on close', 'plan', 'worked'],
    ['a reframe the member kept', 'principle', 'worked'],
    ['a comeback move', 'recovery_move', 'worked'],
    ['what still moves them', 'lights_you_up', 'learned'],
  ];
  for (const [what, keeperType, expected] of routes) {
    assert.equal(tabFor({ keeperType, section: 'what_works' }), expected, `${what} (${keeperType}) belongs under "${expected}"`);
  }
});

test('the journal is intake, not a chapter — it never joins the other tabs', () => {
  assert.equal(chapterKey({ keeperType: 'principle', section: 'journal' }), null);
  assert.equal(tabFor({ section: 'journal' }), null);
});

test('legacy entries written before keeper types still route by section', () => {
  // 0046 added keeper types; anything older has only a section, and must not vanish.
  assert.equal(tabFor({ keeperType: null, section: 'what_works' }), 'worked');
  assert.equal(tabFor({ keeperType: null, section: 'why_works' }), 'learned');
  assert.equal(tabFor({ keeperType: null, section: 'own_words' }), 'learned');
});

test('every chapter has a tab — a chapter cannot become unreachable', () => {
  for (const c of ['who', 'lights', 'tells', 'plays', 'why'] as const) {
    assert.ok(TAB_FOR_CHAPTER[c], `chapter "${c}" has no tab, so its content is unreachable`);
  }
});

// ── THE DRIFT GUARD, which is the point of this file ─────────────────────────────────────────────────────────
// A new Session that emits a keeperType nobody mapped does not error. chapterKey falls through to 'who', the line
// lands under "What you've learned", and it looks fine — a play filed as a self-discovery, with nothing red. This
// reads the ACTUAL emit points out of the source and fails if any of them is unknown to the mapping.
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === '.next' || f.startsWith('.')) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

test('NO SESSION EMITS A KEEPER TYPE THE PLAYBOOK CANNOT PLACE', () => {
  const emitted = new Set<string>();
  for (const f of [...sourceFiles('app'), ...sourceFiles('lib')]) {
    for (const m of readFileSync(f, 'utf8').matchAll(/keeperType:\s*'([a-z_]+)'/g)) emitted.add(m[1]!);
  }
  assert.ok(emitted.size > 0, 'found no emit points at all — this guard would pass vacuously');

  // A type is PLACED if it routes by TYPE — meaning the chapter is the same whichever section the row happens to
  // carry. A type that falls through routes by SECTION instead, so its chapter changes with the section.
  //
  // (First version of this guard compared against the fallback for ONE section, 'what_works' — whose default is
  // 'plays', the same answer plan/principle/recovery_move correctly give. Three properly-mapped types were
  // reported as broken. The guard was wrong, not the code.)
  const unplaceable = [...emitted].filter(
    (t) => chapterKey({ keeperType: t, section: 'what_works' }) !== chapterKey({ keeperType: t, section: 'why_works' }),
  );
  assert.deepEqual(unplaceable, [], `these keeper types are emitted but not mapped — they fall through to the default tab: ${unplaceable.join(', ')}`);
});
