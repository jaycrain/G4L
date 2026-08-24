// BUTTONS ARE ROUNDED RECTANGLES. 8px, like `button, .btn`.
//
// WHY THIS IS A TEST AND NOT A NOTE. Donna reported this shape THREE TIMES in a single batch — items 3, 17 and 21
// — each on a different surface, because each report was fixed where it was found. The sweep on 2026-08-23 then
// turned up three MORE that she had not reached yet, including .sess-send: the Session workspace's own Send
// button, sitting next to a text field, which is the identical control she reported in item 3.
//
// A standard that lives in prose gets re-litigated by whoever writes the next component. This fails instead.
//
// THE ALLOWLIST IS THE LOAD-BEARING HALF. A rule against pills, applied without its exceptions, would restyle
// controls that are correct — a floating launcher and a segmented control are pills BY CONVENTION, and making
// them rectangles would be a worse product in the name of consistency. Every exception is named, with its reason,
// so adding one is a decision someone has to write down rather than a regex someone quietly widens.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Pills that are RIGHT. Each needs a reason a person can disagree with. */
const DELIBERATE_PILLS: Record<string, string> = {
  '.fb-launch': 'a floating ghost launcher, bottom-left — a pill is what reads as "quiet, always there"',
  '.tri-seg-btn': 'a segmented control; the pill IS the convention (iOS/Android), and a rectangle reads as tabs',
  '.fca-seen-btn': 'operator-only (Founder Console activity), never on a member surface',
};

/** Selectors that name an ACTION the member takes. Chips, tags, dots and badges are not controls. */
const ACTION = /(?:^|[\s.#])(?:[a-z-]*btn|[a-z-]*button|cta|[a-z-]*send\b|[a-z-]*launch\b|open\b|nav\b)/i;
const NOT_A_CONTROL = /chip|tag|\bdot\b|badge|stamp|legend|avatar|medal|crumb|pill-label|-bar\b|cell\b/i;

test('no action button is a pill — 8px, unless it is on the allowlist', () => {
  const css = readFileSync('app/globals.css', 'utf8');
  const offenders: string[] = [];

  for (const [, sel, body] of css.matchAll(/([^{}\n]+)\{([^}]*)\}/g)) {
    const selector = sel.split('\n').pop()!.trim();
    if (selector.startsWith('@') || selector.startsWith('/*')) continue;
    if (!ACTION.test(selector) || NOT_A_CONTROL.test(selector)) continue;

    const m = /border-radius:\s*(\d+)px/.exec(body);
    if (!m) continue;
    const px = Number(m[1]);
    if (px < 16) continue; // 8px standard, with a little room for 10/12px cards that carry a control

    // Allowlisted if the selector CONTAINS a deliberate pill's class (covers `.x:hover`, `.a .x`, media queries).
    if (Object.keys(DELIBERATE_PILLS).some((ok) => selector.includes(ok))) continue;
    offenders.push(`${selector}  →  ${px}px`);
  }

  assert.deepEqual(offenders, [],
    'These read as pills. Buttons are rounded rectangles (8px), matching `button, .btn`:\n  '
    + offenders.join('\n  ')
    + '\n\nIf one of these is DELIBERATELY a pill, add it to DELIBERATE_PILLS in this file with the reason —'
    + '\nthe exceptions are meant to be argued about, not widened by loosening the pattern.');
});

test('the allowlist stays honest — every exception still exists', () => {
  // An allowlist that outlives its entries is how a rule quietly stops applying. If one of these is deleted or
  // renamed, this fails and the exception gets re-argued rather than inherited.
  const css = readFileSync('app/globals.css', 'utf8');
  for (const [sel, why] of Object.entries(DELIBERATE_PILLS)) {
    assert.ok(css.includes(sel), `${sel} is allowlisted (${why}) but no longer exists — drop it from the list`);
  }
});
