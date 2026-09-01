// RECONNECT OPENS ON THE MIRROR, AND THE DASHBOARD HAS TO AGREE.
//
// Jay, 2026-08-28, on a fresh walk: the dashboard offered "Program › Reconnect › 2 of 3 — The Doors" to a member
// who had done neither Session. "Right off the bat, still leading with Doors… I need to see IDQ as the first
// Session and how it feels."
//
// FOUR PLACES DESCRIBE THE ORDER OF RECONNECT, and after the Session split three of them said the Mirror comes
// first — the arcs (RECONNECT_R1_ARC = measurement), the session registry (r1 · The Mirror), and the summaries.
// The fourth is lib/curriculum, and it is the only one the dashboard reads. There the IDQ was still
// `kind: 'measurement'` with no route, so `isBuilt()` called it content-pending, the forecast skipped it, and
// keyFromForecast mapped the next asset ('…FDR') to 'r2'.
//
// Nothing was mis-ORDERED. The IDQ already sorted ahead of the Doors. It just was not something a member could
// be sent to, and "cannot be opened" and "already done" look identical from the dashboard.
//
// This test pins the two facts that have to stay true together: the Mirror is the first REACHABLE Reconnect
// asset, and a member with no history resolves to r1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURRICULUM } from '../lib/curriculum/registry.ts';
import { keyFromForecast } from '../lib/workspace/session-key.ts';
import { sessionsForPhase } from '../lib/workspace/session-registry.ts';

const reconnect = CURRICULUM.filter((a) => a.phase === 'reconnect' && a.layer !== 'Daily');
// The same "is this actually built" rule the forecast applies (lib/curriculum/view.ts).
const isBuilt = (a: (typeof CURRICULUM)[number]) =>
  (a.kind === 'session' && !!a.steps?.length) || a.kind === 'checkpoint' || !!(a as { route?: string }).route;

test('the first REACHABLE Reconnect asset is the Mirror', () => {
  const built = reconnect.filter(isBuilt).sort((a, b) => a.order - b.order);
  assert.ok(built.length > 0, 'no built Reconnect assets at all');
  // R1's member-facing name is IDQ as of 2026-08-31 (Jay, as brand owner): we lead with the instrument we own,
  // and 'the Mirror' was never a term we would lead with. Greg's IDQ and the member's Session name are now the same.
  assert.equal(built[0]!.id, 'RCN-IDQ',
    `the dashboard lights the first BUILT asset; it is ${built[0]!.id} (${built[0]!.title})`);
});

test('being ordered first is not enough — it has to be openable', () => {
  // The exact failure. The IDQ was order 2 against the Doors at order 3, so every ordering check passed while
  // the member was still sent to the Doors. Sorting first and being reachable are two different properties and
  // only one of them was ever true.
  const idq = reconnect.find((a) => a.id === 'RCN-IDQ')!;
  assert.ok(isBuilt(idq), 'the Mirror must be built, or the forecast treats it as content-pending and skips it');
});

test('a member with no history resolves to r1, not r2', () => {
  const idq = CURRICULUM.find((a) => a.id === 'RCN-IDQ')!;
  assert.equal(keyFromForecast('reconnect', { id: idq.id, route: (idq as { route?: string }).route, kind: idq.kind }), 'r1');
  // And the fallback still holds for a member the forecast can say nothing about.
  assert.equal(keyFromForecast('reconnect', null), 'r1');
});

test('the curriculum and the session registry tell the same story', () => {
  // Two tables, one order. The registry drives the workspace breadcrumb ("2 of 3") and the curriculum drives
  // which step is lit — so when they disagree the member gets a correct-looking breadcrumb over the wrong
  // Session, which is exactly what Jay was shown. [[one-fact-many-sites]]
  const registry = sessionsForPhase('reconnect').filter((s) => s.kind === 'session');
  assert.equal(registry[0]!.id, 'r1');
  // 'The Distance' since 2026-09-01 — the member-facing name for R1. (This file's name still says idq; it is
  // about R1 OPENING Reconnect, which has not changed, and renaming it would cost more than it explains.)
  assert.equal(registry[0]!.label, 'The Distance');

  const firstBuilt = reconnect.filter(isBuilt).sort((a, b) => a.order - b.order)[0]!;
  assert.equal(keyFromForecast('reconnect', { id: firstBuilt.id, route: (firstBuilt as { route?: string }).route }),
    registry[0]!.id, "the curriculum's first step and the registry's first Session must be the same Session");
});

// ── THE MOBILE TAB BAR HOLDS ITS OWN BUTTONS ─────────────────────────────────────────────────────────────────
//
// Jay, same walk: "The tab headings aren't vertically centered, neither is selector."
//
// The track was 34px. There is a deliberate 44px tap-target floor for buttons under 1100px, and .tri-seg-btn is
// not exempt from it — so each tab rendered 44px tall inside a 34px bar, the white selector overflowed its
// track, and both it and its label sat 7px below the bar's centre. Measured, not eyeballed.
//
// The floor is written with :where() precisely so a component can opt out by declaring its own min-height. Doing
// that here would have made a phone's primary navigation a 30px target to save 14px of bar, so the track grew
// instead. This test pins the arithmetic that makes them agree.
import { readFileSync as readCss } from 'node:fs';
const CSS = readCss(new URL('../app/globals.css', import.meta.url), 'utf8');

test('the mobile tab track is tall enough for the tap-target floor it inherits', () => {
  // ANCHORED ON THE RULE, not scanned from the media query. The first version started at
  // `@media (max-width: 1100px)` and ran non-greedily to the next `min-height:` it could find — which belonged
  // to a different rule and read 52px. That is the third time today a guard of mine has crossed a block
  // boundary looking for a value; match the selector that actually declares it.
  const floor = Number(CSS.match(/button:where\(:not\([^)]*\)\)[\s\S]{0,200}?min-height:\s*(\d+)px/)![1]);
  const seg = CSS.match(/\.tri-seg \{[^}]*height:\s*(\d+)px[^}]*\}/)![1];
  const pad = Number(CSS.match(/\.tri-seg \{[^}]*padding:\s*(\d+)px/)![1]);

  assert.equal(Number(seg), floor + pad * 2,
    `a ${seg}px track cannot hold ${floor}px buttons plus ${pad}px padding — the selector overflows and sits low`);

  // And the tabs must NOT have opted out of the floor to make the numbers work.
  const btn = CSS.match(/\.tri-seg-btn \{([^}]*)\}/)![1]!;
  assert.doesNotMatch(btn, /min-height/, 'exempting the tabs would shrink a primary phone target below 44px');
});

// ── "RECONNECT IS SPECIAL" MACHINERY, RETIRED ────────────────────────────────────────────────────────────────
//
// Jay's R1 walk showed the IDQ under the title "The Drift Quiz", with the same "Why it works" card rendered
// twice before he had answered question 1.
//
// One cause. Reconnect used to be ONE page running an eight-stage arc across three assets, so three things were
// special-cased for it: the header derived its title from the current BEAT (positionLabel could only say
// "Reconnect"), the teaching layer resolved science by beat, and the cards were interleaved into the thread at
// the message where each was earned. The Session split made Reconnect ordinary — three Sessions, each 1:1 with
// its asset, each its own page — and all three survived it reading the PRE-SPLIT beat order, in which
// `measurement` came fourth rather than first.
//
// So on question 1 of the first Session the header showed a Session three steps away, and the layer scored him
// as having finished the Doors and the Drift Quiz.
//
// The fix was deletion, not remapping: every phase now uses one rule.
test('the workspace header uses one rule for every phase', () => {
  const src = readCss(new URL('../app/workspace/workspace-session.tsx', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(code, /reconnectStageTitle\(/,
    'a beat-derived title for one phase is how the IDQ got labelled "The Drift Quiz"');
  assert.match(code, /wayfinding\.positionLabel/, 'positionLabel already says "The Mirror · Session 1 of 3"');
});

test('Reconnect shows ONE science card, after its close, like every other arc', () => {
  const src = readCss(new URL('../app/reconnect/reconnect-chat.tsx', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  // Exactly one render site, gated on the engine's own close — not on how far through a beat order we are.
  assert.equal((code.match(/<TeachingUnderstand/g) ?? []).length, 1, 'one card per Session');
  assert.match(code, /done && !seenThisSession/, 'shown at the close, and never twice');

  // The multi-card machinery must not come back with it.
  assert.doesNotMatch(code, /placeTeachingCards|reconnectTaughtSoFar/,
    'these derive cards from beat order, which is what showed two of them on question 1');
});
