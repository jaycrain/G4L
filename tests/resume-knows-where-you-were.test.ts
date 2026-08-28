// A RESUMED SESSION KNOWS HOW FAR YOU GOT.
//
// Jay, 2026-08-28, switching between the dashboard and R1: the thread showed a late IDQ item and two answers he
// had given, and the chip row under it read "QUESTION 1 OF 24".
//
// `expectsForState(arc, state, answered = 0)` never read the count from the state it was handed. Rewire, Rebuild
// and Reclaim each derived `saved.state.administeredResponses?.length ?? 0` at their own call site and passed it
// in; Reconnect's two call sites did not. So resuming the IDQ — the longest instrument in the product, and the
// one a member is most likely to step away from — always came back at item one.
//
// THE SAME SHAPE AS THE OTHER TWO TODAY: a parameter whose default means "nothing has happened yet", on a code
// path that only ever runs when something has. gapOpen's `history = []` did the same thing to the Doors
// teaching. A default is not a safe fallback when the honest value is always available.
//
// The function's own docstring had already made the argument — "a signature that lets a caller omit them is a
// signature that invites this bug back. The seam is closed by removing the choice" — about a signature that
// still let a caller omit the count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { expectsForState } from '../lib/agent/onboarding-staged.ts';
import { RECONNECT_R1_ARC } from '../lib/agent/reconnect.ts';
import { TOTAL_ITEMS } from '../lib/idq/instrument.ts';
import type { ConvState } from '../lib/agent/onboarding.ts';

const resumedAt = (answered: number) =>
  expectsForState(RECONNECT_R1_ARC, {
    stage: 'measurement',
    administeredResponses: Array(answered).fill(3),
    collected: {},
  } as ConvState);

test('the IDQ resumes on the item the member is actually on', () => {
  for (const answered of [0, 1, 7, TOTAL_ITEMS - 1]) {
    const e = resumedAt(answered) as { kind: string; index?: number; total?: number } | undefined;
    assert.ok(e, `no expectation at ${answered} answered`);
    assert.equal(e!.kind, 'scale');
    assert.equal(e!.index, answered + 1, `resumed at item ${e!.index} after ${answered} answers`);
    assert.equal(e!.total, TOTAL_ITEMS);
  }
});

test('no caller can supply its own count — the state is the only source', () => {
  // The three arcs that got this right did so by each computing the same expression at their own call site,
  // which is why the fourth could quietly not. There is one derivation now, inside the function.
  const src = readFileSync(new URL('../lib/agent/onboarding-staged.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.match(src, /export function expectsForState\(arc: ArcConfig, state: ConvState\)/,
    'no `answered` parameter — it is derived from the state');

  // Asserted as "no call site derives its own count" rather than by parsing the argument list — the first
  // version used `expectsForState\(([^)]*)\)`, which stops at the first ')' and so read `rebuildArcFor(session`
  // as the whole call. Regexes and nested parens; the intent is easier to state directly.
  const app = new URL('../app/', import.meta.url).pathname;
  const actions = readdirSync(app, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('actions.ts'))
    .map((f) => ({ f, src: readFileSync(app + f, 'utf8') }));
  assert.ok(actions.length >= 4, `expected the arc actions; found ${actions.length}`);
  for (const { f, src: a } of actions) {
    assert.doesNotMatch(a, /expectsForState\([^;]*,\s*answered\s*\)/, `${f} passes its own count`);
    assert.doesNotMatch(a, /const answered = saved\.state\.administeredResponses/,
      `${f} still hand-derives the count — that duplication is what let Reconnect skip it`);
  }
});

test('the Reconnect chat reloads when the SESSION changes, not only the member', () => {
  // The second half of what he hit. The load effect ran on [memberId] with a boolean guard, so a component
  // reused across a Session change kept the previous Session's messages and state — a late item sitting above
  // the next Session's "Question 1 of 24" chips.
  const src = readFileSync(new URL('../app/reconnect/reconnect-chat.tsx', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.match(src, /\}, \[memberId, session\]\)/, 'the load effect must key on the session too');
  assert.match(src, /started\.current === session/, 'and the guard must remember WHICH session it started');
});
