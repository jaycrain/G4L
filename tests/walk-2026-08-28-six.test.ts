// THE SIX FROM DONNA'S WALK, PLUS THE RECONNECT BREAK — replayed offline.
//
// Everything here touches either the live capture loop or the copy a member reads at the most vulnerable beats,
// so each fix is pinned by the BEHAVIOUR she described rather than the code that produces it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { memberDisplay } from '../lib/agent/member-display.ts';
import { serializeBoardSubmission } from '../lib/reconnect/doors-board-claim.ts';

// ── 2 · the Doors receipt is gone, WITHOUT reopening the wire-string leak ─────────────────────────────────────
test('a board submission renders as nothing — and never as its wire string', () => {
  // Built through the real serializer, not a hand-typed string — a fixture that invents the wire format proves
  // nothing about the format the board actually emits.
  const wire = serializeBoardSubmission({
    doors: [{ slug: 'body', relevance: 2 }, { slug: 'aging_parents', relevance: 3 }],
    quietDrift: false,
    first: 'body',
    biggest: 'aging_parents',
    stillOpen: ['grind'],
  } as never);
  assert.match(wire, /^\[board\]/, 'sanity: the serializer really did produce a wire string');
  const shown = memberDisplay(wire);
  assert.equal(shown, '', 'Donna: "Remove it" — the receipt renders to nothing');
  assert.doesNotMatch(shown, /\[board\]/, 'and must never fall through to the raw wire string');
});

test('memberDisplay distinguishes "renders to nothing" from "not my format"', () => {
  // The trap: `if (shown)` treats '' as no-match and falls through to the raw text. That would have put
  // `[board] door:body=2 …` back on screen as a side effect of DELETING a line of copy.
  const typed = 'I marked the two that were really mine.';
  assert.equal(memberDisplay(typed), typed, 'ordinary prose is still returned verbatim');
});

// ── 3 · the Reclaim List is not read back to her ──────────────────────────────────────────────────────────────
test('the list she just typed into the builder is not echoed at her', () => {
  const src = readFileSync(new URL('../lib/agent/onboarding-staged.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Here's what you wrote —/,
    'her 12:49 screenshot: the identical text, ten pixels below her own bubble');
});

// ── 1 · the "Waiting on you" card is the standard grey, not a warm near-neutral ───────────────────────────────
test('the queue card uses --grey, and --grey is actually neutral', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const rule = css.match(/\.pb-jq \{[^}]*\}/)![0];
  assert.match(rule, /background: var\(--grey\)/, 'the standard grey used elsewhere in the app');
  assert.doesNotMatch(rule, /var\(--wash\)/, '--wash is #f5f4f1 — warm, which is why she still read it as olive');
  // Pin the reason, so a future "tidy" cannot swap them back believing they are interchangeable.
  const grey = css.match(/--grey:\s*#([0-9a-f]{6})/i)![1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(grey.substr(i, 2), 16));
  assert.equal(r === g || Math.abs(r - b) <= 2, true, `--grey must be neutral; got #${grey}`);
});

// ── THE BREAK IS GONE, REPLACED BY A REAL SESSION BOUNDARY ────────────────────────────────────────────────────
// This morning's in-conversation break lived at doors → measurement and was standing in for a Session boundary.
// Reconnect is three Sessions and a Checkpoint now, so the seam IS the ending: R2 closes, the member is returned
// to the dashboard, the ring moves and R3 is teed up. The behaviour those three tests protected — a member can
// stop here, and stopping costs nothing — is now asserted in tests/reconnect-receive-handoff.test.ts against the
// Session close, and by the four-boundary fixtures in tests/reconnect-sessions.test.ts.

// ── 5 · the Doors confirm is a tap, like drift and window ─────────────────────────────────────────────────────
test('every drawout confirm in Reconnect offers chips — the Doors one was the last without', () => {
  const src = readFileSync(new URL('../lib/agent/reconnect.ts', import.meta.url), 'utf8');
  for (const c of ['DOOR_CONFIRM', 'DRIFT_CONFIRM', 'WINDOW_CONFIRM']) {
    assert.match(src, new RegExp(`beatConfirmUnlessLeaving\\(b\\.memberMessage, ${c}\\)`),
      `${c} must be offered as a tap — English has unlimited ways to say yes`);
  }
});
