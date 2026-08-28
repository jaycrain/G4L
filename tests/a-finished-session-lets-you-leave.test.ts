// A FINISHED SESSION RECORDS ITSELF AND LETS YOU LEAVE.
//
// Jay, 2026-08-28. R1 closed correctly — he read the new close naming the Doors as next — tapped "Got it", and
// was left on a screen that still offered a text box. He typed "Ok" and got "Something went wrong". Stuck.
//
// TWO FAULTS, and both are the same omission: Reconnect used to have exactly one ending.
//
// 1 · THE INPUT STAYED LIVE. Every other arc hides its composer at `done`; Reconnect never needed to, because as
//     one continuous conversation its only ending was the ceremony, which replaces the screen. Three Sessions
//     that each END is a different thing. His turn then failed because the Session was complete and cleared —
//     there was no conversation left for it to join.
//
// 2 · AND THERE WAS NO WAY OUT. No hand-home, for the same reason. The end of a Session was a dead end.
//
// 3 · WORSE, AND INVISIBLE: the Session was never RECORDED as closed. persistReconnectSessionCloses detects a
//     close by watching for a stage CHANGE (`from !== to`), and R1 finishes ON the measurement stage —
//     `complete = true`, stage unchanged — so it returned early. The forecast reads closed sessions to decide
//     what is next, so having finished the Mirror he would have been sent straight back into it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chat = readFileSync(new URL('../app/reconnect/reconnect-chat.tsx', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const actions = readFileSync(new URL('../app/reconnect/actions.ts', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('a completed Session takes no more input', () => {
  // Both the structured controls and the text box. The chips are the input on an administered turn, so gating
  // only the composer would still leave a finished IDQ tappable.
  for (const control of ['doors_board', 'scale', 'beat_confirm']) {
    assert.match(chat, new RegExp(`!done && expects\\?\\.kind === '${control}'`), `${control} must close at done`);
  }
  assert.match(chat, /!done && showComposer\(/, 'and so must the text box');
});

test('a completed Session offers the way home', () => {
  assert.match(chat, /done && !awaitingContinue && !ceremony/, 'the hand-home appears once the Session is over');
  assert.match(chat, /notifySessionComplete\(\)/,
    'and fires the same event Rewire/Rebuild/Reclaim do — the workspace owns the receipt and the navigation');
});

test('a Session that ends WITHOUT changing stage is still recorded as closed', () => {
  // The invisible one. R1 completes on the measurement stage, so the `from !== to` boundary watcher never sees
  // it. Without this the forecast keeps lighting a Session the member has already finished.
  assert.match(actions, /if \(turn\.complete\)/, 'the close is driven by the Session ending, not by a stage change');
  assert.match(actions, /RECONNECT_SESSION_ASSET/, 'each Session maps to its own asset for that close');

  // And the map has to cover every Session, or one of them silently never closes.
  const map = actions.match(/const RECONNECT_SESSION_ASSET[^}]*\}/)![0];
  for (const key of ['r1', 'r2', 'r3', 'checkpoint']) {
    assert.match(map, new RegExp(`\\b${key}:`), `${key} has no asset — it could never be recorded as done`);
  }

  // The close must be evaluated BEFORE the early return, or it is unreachable for exactly the case it exists for.
  const fn = actions.slice(actions.indexOf('async function persistReconnectSessionCloses'));
  assert.ok(fn.indexOf('if (turn.complete)') < fn.indexOf('if (from === to) return;'),
    'the completion close must come before the `from === to` early return');
});
