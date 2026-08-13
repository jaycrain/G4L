import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// DOES THE TEXT PASS ON THE GROUND IT IS ACTUALLY ON?
//
// There is already a guard for reaching past a `-text` twin to a raw brand token. It did not catch this, and the
// reason is worth keeping: I used the twin correctly and still failed, because the twin is documented against
// WHITE and the thing I put it on was a grey pill. --teal-text at #2f7a7b is 5.01:1 on white, 4.44:1 on the
// Playbook's tab (#f2f1ef), 4.03:1 on its hover (#e8e6e6). Jay saw it the hour it shipped: "still have a
// contrast problem here".
//
// "Which token" is the wrong question. "This colour, on THAT ground" is the question, and it can only be
// answered by naming the pair — which is what this file is. Every row is a place a member reads text; add one
// when you add a colour/ground combination the existing rows do not already cover.

const CSS = readFileSync('app/globals.css', 'utf8');

/** Resolve a `--token` to its hex from :root, so the pairs below track the stylesheet instead of copying it. */
function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(CSS);
  assert.ok(m, `--${name} not found in globals.css`);
  return m![1]!;
}

const srgb = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgb(r!) + 0.7152 * srgb(g!) + 0.0722 * srgb(b!);
}
export function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)];
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * fg · bg · where. A value starting with `#` is a literal; anything else is a token name resolved from the
 * stylesheet, so these rows track globals.css rather than duplicating it.
 *
 * GROUNDS ARE WRITTEN OUT because the ground is the thing that gets guessed wrong.
 */
const PAIRS: [string, string, string][] = [
  // The failure that prompted this file — the Playbook tab counts, on the pill and on its hover.
  ['teal-text', '#f2f1ef', 'Playbook tab count on an inactive tab'],
  ['teal-text', '#e8e6e6', 'Playbook tab count on a hovered tab'],
  ['#4a5d6b', '#f2f1ef', 'Playbook tab label on an inactive tab'],
  ['#ffffff', 'navy', 'Playbook tab label on the active tab'],
  // The -text twins on white, which is what they were originally chosen against.
  ['teal-text', '#ffffff', 'teal text on a white card'],
  ['orange-text', '#ffffff', 'orange text on a white card'],
  ['olive-text', '#ffffff', 'olive text on a white card'],
  ['muted-grey', '#ffffff', 'muted body copy on a white card'],
  ['muted-grey-2', '#ffffff', 'the second muted grey on a white card'],
  // The navy hero: its sub is white at 82%, which composites to ~#d5dade over navy.
  ['#d5dade', 'navy', 'the hero sub on navy'],
];

const resolve = (v: string) => (v.startsWith('#') ? v : token(v));

test('every text colour clears AA (4.5:1) on the ground it is actually rendered on', () => {
  const fails: string[] = [];
  for (const [fg, bg, where] of PAIRS) {
    const [f, g] = [resolve(fg), resolve(bg)];
    const r = contrast(f, g);
    if (r < 4.5) fails.push(`${where}: ${f} on ${g} = ${r.toFixed(2)}:1`);
  }
  assert.deepEqual(fails, [], `\n${fails.join('\n')}\n`);
});

test('THE GUARD CAN FAIL — the exact colour Jay caught is still detected as failing', () => {
  // Proof the maths is real rather than a function that returns "fine". #2f7a7b was live for about an hour.
  assert.ok(contrast('#2f7a7b', '#f2f1ef') < 4.5, 'the old teal must still measure as a failure');
  assert.ok(contrast('#2f7a7b', '#ffffff') >= 4.5, '...and must still pass on white, which is why it was missed');
});

// A BUTTON THAT REPAINTS ITS BACKGROUND MUST REPAINT ITS TEXT.
//
// The global rule gives every button `color: var(--white)`, which is right for a filled CTA. A control that
// overrides the BACKGROUND to something light and says nothing about colour therefore renders white-on-light —
// invisible. That is what happened to the Playbook's outcomes strip: Mindfulness / Fitness / Wellness were
// unreadable at rest and only appeared on hover, when the default navy hover background arrived behind them.
//
// Jay pointed at that strip twice while I measured the tab counts next to it, because "contrast problem" reads
// as "a colour is too light" and this was text that wasn't there at all.
const BUTTONISH = /(^|\s|\.)(btn|button)|-(row|tab|cta|chip|pill)\b/i;
const LIGHT_BG = /background:\s*(var\(--white\)|#fff\b|#ffffff|var\(--grey\)|#f[0-9a-f]{5}|#e[0-9a-f]{5})/i;

/** Every selector that declares a text colour, so a state modifier can be credited to its base rule. */
function selectorsThatSetColour(): Set<string> {
  const set = new Set<string>();
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/(?<![-\w])color:/.test(m[2]!)) set.add(m[1]!.trim().split('\n').pop()!.trim());
  }
  return set;
}

test('no control paints itself a light background while inheriting white text', () => {
  const coloured = selectorsThatSetColour();
  const offenders: string[] = [];
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1]!.trim().split('\n').pop()!.trim();
    const body = m[2]!;
    if (sel.startsWith('@') || sel.includes(':hover')) continue; // a hover rule inherits its base rule's colour
    if (!BUTTONISH.test(sel) || !LIGHT_BG.test(body)) continue;
    if (/(?<![-\w])color:/.test(body)) continue; // it says what colour its text is — fine
    // A STATE MODIFIER inherits from its base: `.rm-chip.on` only repaints the background of a `.rm-chip` that
    // already declares navy. Credit the base rather than reporting a chip that is perfectly readable.
    const base = sel.match(/^\.[a-z0-9-]+/i)?.[0];
    if (base && base !== sel && coloured.has(base)) continue;
    offenders.push(sel);
  }
  assert.deepEqual(
    offenders,
    [],
    `\nThese set a light background but never a text colour, so they inherit white from the global button rule:\n${offenders.join('\n')}\n`,
  );
});
