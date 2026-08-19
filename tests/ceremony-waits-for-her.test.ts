// "At the end of a session, right before a ceremony launches, the Companion can display text and then advance to
// the ceremony too quickly for the message to actually be read — with no way to scroll back and see what was
// missed." (Donna, 2026-08-19.)
//
// All four arcs painted the closing reply and raised the full-screen overlay on the SAME tick. Jay hit the
// identical shape on 2026-08-11 with the end card — "this triggered too quickly and didn't show me the Companion's
// wrap up" — and it was fixed by making the member ask for what comes next. The ceremony kept auto-firing, in all
// four arcs, because the fix was applied to the card rather than to the pattern.
//
// This is a source guard rather than a render test: the four chats are client components with a full ceremony
// overlay behind them, and what has to hold is structural — the reveal is HELD, and the thread is still on screen
// while it waits.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ARCS = [
  'app/rewire/rewire-chat.tsx',
  'app/rebuild/rebuild-chat.tsx',
  'app/reclaim/reclaim-chat.tsx',
  'app/reconnect/reconnect-chat.tsx',
];

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('no arc raises its ceremony on the same tick as the message', () => {
  for (const p of ARCS) {
    const s = src(p);
    assert.match(s, /setPendingCeremony\(c\.data\)/, `${p}: the reveal must be HELD, not shown`);
    assert.doesNotMatch(
      s,
      /if \(c\.ok && c\.data\) setCeremony\(c\.data\)/,
      `${p}: showing it straight from the turn is the bug — it covers the line she was just given`,
    );
  }
});

test('the thread is STILL VISIBLE while the reveal waits', () => {
  // The first version of this fix returned the gate INSTEAD of the thread, which hid the very message it existed
  // to give her time to read. Caught before it shipped; pinned here because it is the obvious wrong shape.
  for (const p of ARCS) {
    const s = src(p);
    const gate = s.indexOf('pendingCeremony && !ceremony');
    assert.ok(gate > 0, `${p}: the gate must exist`);
    // It renders inside the JSX tree (as a {…} expression), not as an early `return` above it.
    assert.doesNotMatch(
      s.slice(0, gate),
      /if \(pendingCeremony && !ceremony\) \{\s*return/,
      `${p}: an early return would replace the thread with the gate`,
    );
    assert.match(s.slice(gate - 200, gate + 400), /<div className="chat-continue">/, `${p}: it sits below the thread`);
  }
});

test('she can always get through — the gate has exactly one control, and it opens the reveal', () => {
  // A gate with no way out is worse than the bug it replaced.
  for (const p of ARCS) {
    const s = src(p);
    const at = s.indexOf('pendingCeremony && !ceremony');
    const block = s.slice(at, at + 400);
    assert.match(block, /onClick=\{\(\) => setCeremony\(pendingCeremony\)\}/, `${p}: the tap promotes the loaded data`);
  }
});
