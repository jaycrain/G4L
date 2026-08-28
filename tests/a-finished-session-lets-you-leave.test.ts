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
  assert.match(actions, /RECONNECT_SESSION_ASSETS/, 'each Session maps to its own asset for that close');

  // And the map has to cover every Session, or one of them silently never closes. It lives in session-key.ts
  // now — the workspace needs the same crosswalk to decide whether a finished Session opens read-only.
  const keys = readFileSync(new URL('../lib/workspace/session-key.ts', import.meta.url), 'utf8');
  const map = keys.match(/const RECONNECT_SESSION_ASSETS[^}]*\}/)![0];
  for (const key of ['r1', 'r2', 'r3', 'checkpoint']) {
    assert.match(map, new RegExp(`\\b${key}:`), `${key} has no asset — it could never be recorded as done`);
  }

  // The close must be evaluated BEFORE the early return, or it is unreachable for exactly the case it exists for.
  const fn = actions.slice(actions.indexOf('async function persistReconnectSessionCloses'));
  assert.ok(fn.indexOf('if (turn.complete)') < fn.indexOf('if (from === to) return;'),
    'the completion close must come before the `from === to` early return');
});

// ── AND YOU CANNOT WALK BACK INTO A SESSION YOU HAVE FINISHED ────────────────────────────────────────────────
//
// Jay: "Aren't the Sessions linear, once you're through you can't get back to it?" They are meant to be, and the
// workspace already had the rule — a Session that is CLOSED with no live state opens read-only instead of
// starting over. It asks `curriculumIdFor(sessionKey)` for the asset to look up, and every Reconnect key
// answered `undefined`, so the whole check was skipped.
//
// That is what let him re-enter the Mirror and take the 24-item instrument again — three more times, writing
// three spurious retakes against an instrument whose contract is one reading per 60 days. The instrument was
// never the problem, which is why an idempotency window would have been the wrong fix: nothing should have been
// able to ask it a second time.
import { curriculumIdFor, RECONNECT_SESSION_ASSETS } from '../lib/workspace/session-key.ts';
import { CURRICULUM } from '../lib/curriculum/registry.ts';

test('every Reconnect Session resolves to its curriculum asset', () => {
  // Without this the read-only redirect cannot fire, and a finished Session restarts.
  // r2's own row is RCN-FDR ("The Doors") — the Session's identity. RCN-EXC ("Identity Excavation") is a second
  // row the same conversation covers, and closing only THAT one is what left the forecast pointing him back into
  // a Session he had just finished.
  for (const [key, asset] of [['r1', 'RCN-IDQ'], ['r2', 'RCN-FDR'], ['r3', 'RCN-DFT'], ['r4', 'RCN-CHK']] as const) {
    assert.equal(curriculumIdFor(key as never), asset, `${key} must resolve, or it can never be seen as closed`);
  }
});

test('the crosswalk names assets that actually exist', () => {
  // A map pointing at an id the curriculum does not have would resolve, pass the check above, and then never
  // match a closed session — the same silence, one layer down.
  const ids = new Set(CURRICULUM.map((a) => a.id));
  for (const asset of Object.values(RECONNECT_SESSION_ASSETS).flat()) {
    assert.ok(ids.has(asset), `${asset} is not in the curriculum`);
  }
});

test('the crosswalk is defined ONCE', () => {
  // The close path (app/reconnect/actions.ts) and the read-only redirect (the workspace) need the same fact.
  // Two copies is how they drift, and a drifted copy here means a Session that closes but never locks.
  const act = readFileSync(new URL('../app/reconnect/actions.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(act.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''),
    /const RECONNECT_SESSION_ASSETS/, 'the action must import the map, not declare its own');
});

test('a Session closes EVERY curriculum row it covers', () => {
  // Reconnect has seven rows and three Sessions: the rows are Greg's assets, the Sessions are what a member
  // sits down to do. Close a subset and the forecast lights a row that has already been worked — which is what
  // put "Nice work — The Doors is next" directly under "You finished Identity Excavation today".
  assert.deepEqual(RECONNECT_SESSION_ASSETS.r2, ['RCN-FDR', 'RCN-EXC']);
  assert.deepEqual(RECONNECT_SESSION_ASSETS.r3, ['RCN-DFT', 'RCN-WIN', 'RCN-WIN-LIST']);

  // Every non-daily Reconnect row must be covered by exactly one Session, or it can never be closed at all.
  const covered = Object.entries(RECONNECT_SESSION_ASSETS)
    .filter(([k]) => k !== 'checkpoint') // an alias for r4, not a fifth Session
    .flatMap(([, v]) => v);
  const rows = CURRICULUM.filter((a) => a.phase === 'reconnect' && a.layer !== 'Daily').map((a) => a.id);
  for (const id of rows) assert.ok(covered.includes(id), `${id} belongs to no Session — nothing can ever close it`);
  assert.equal(new Set(covered).size, covered.length, 'a row claimed by two Sessions would close early');
});

test('the Session\'s own row closes LAST, so the dashboard names the Session', () => {
  // "You finished X today" reads the most recently closed row. Closing in array order named the covered row
  // instead of the Session — "You finished Identity Excavation today" about a Session called The Doors.
  assert.match(actions, /\.reverse\(\)/, 'covered rows close first, the Session\'s own row last');
});

// ── A PARTLY-CLOSED SESSION IS A FINISHED SESSION ────────────────────────────────────────────────────────────
//
// Jay, mid-walk: "Does a refresh advance me?" It did not, and could not — his R2 completed before v3.5.22, so
// only RCN-EXC was marked and RCN-FDR stayed open. The forecast lights the first OPEN row, so it offered him The
// Doors again underneath "You finished Identity Excavation today".
//
// A Session closes all of its rows together, so a partial set is never a member mid-Session — it is the record
// of a Session that was worked while something was only closing part of it. Repairing it forward is honest;
// asking him to re-walk forty minutes to satisfy a bookkeeping gap is not.
test('the reconcile repairs a partial close, and never invents work', () => {
  const src = readFileSync(new URL('../lib/curriculum/view.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  assert.match(src, /RECONNECT_SESSION_ASSETS/, 'it reads the Session→rows crosswalk, not a hand-listed set');
  // The safety property: SOME row closed → close the rest. NO row closed → touch nothing, so a member who has
  // not reached a Session is never credited with it.
  assert.match(src, /anyClosed/, 'a Session with no rows closed must be left alone');
  assert.match(src, /if \(!anyClosed\) continue;/, 'and that has to be the guard, not a comment about one');
});
