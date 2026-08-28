// A FONT-WEIGHT THE FACE DOES NOT CARRY IS A LIE THE SCREEN TELLS QUIETLY.
//
// The browser does not fail on an unloaded weight. It silently substitutes the nearest one it has, so the
// stylesheet says one thing and the screen shows another with nothing to warn you — no console error, no visual
// tell beyond "that looks a bit off".
//
// This has now happened twice, four days apart, in the same file:
//   · 2026-08-21 — five rules asked Barlow for 500 with no 500 loaded. They rendered at 400. Donna counted six
//     weights in the source; only four ever reached a member.
//   · 2026-08-27 — Donna asked for the intro headlines in SemiBold. `.onbwel-head` and `.onbwel-d-head` were set
//     to 600 while Barlow Condensed loaded only 800 and 900, so they kept rendering at 800. Shipped, screenshotted
//     and reported as done before Jay put the mockup beside the live page and said the weights did not match.
//
// The second one is the reason this test exists rather than another comment. A note telling the next person to add
// the weight first was already in layout.tsx — I read it, applied it to one family, and missed that the family two
// lines below kept its own list.
//
// NOTE THE DIRECTION, because it decides what the bug looks like: CSS font matching walks DOWN first for a desired
// weight at or below 500, and UP first above it. The 500 bug rendered too light; the 600 bug rendered too heavy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LAYOUT = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const CSS = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

/** The weights actually downloaded for a next/font family, read from its declaration. */
function loadedWeights(fontFn: string): number[] {
  const decl = LAYOUT.match(new RegExp(`${fontFn}\\(\\{([\\s\\S]*?)\\}\\)`));
  assert.ok(decl, `could not find the ${fontFn}({...}) declaration`);
  const list = decl[1]!.match(/weight:\s*\[([^\]]*)\]/);
  assert.ok(list, `${fontFn} declares no weight list`);
  return [...list[1]!.matchAll(/'(\d+)'/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
}

/** Declaration blocks in globals.css, as {selector, body}. Good enough: this file has no nested at-rule blocks
 *  inside a ruleset, so a non-greedy brace match does not straddle rules. */
function blocks(): { selector: string; body: string }[] {
  return [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    // The capture runs back to the previous `}`, so it drags along whatever comments and blank lines sat between
    // the rules. Strip block comments, then keep the last non-empty line — that is the selector list.
    selector: m[1]!.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.trim()).filter(Boolean).pop() ?? '',
    body: m[2]!,
  }));
}

test('the display face carries every weight the display rules ask of it', () => {
  const condensed = loadedWeights('Barlow_Condensed');
  const offenders: string[] = [];
  for (const { selector, body } of blocks()) {
    if (!body.includes('--font-condensed')) continue; // not a display rule
    const w = body.match(/font-weight:\s*(\d+)/);
    if (!w) continue;
    const n = Number(w[1]);
    if (!condensed.includes(n)) offenders.push(`${selector} asks for ${n}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `Barlow Condensed loads [${condensed.join(', ')}]. Add the weight in app/layout.tsx or change the rule — ` +
      `an unloaded weight renders as the nearest one with no warning.\n  ${offenders.join('\n  ')}`,
  );
});

test('Donna\'s SemiBold intro headlines can actually render as SemiBold', () => {
  const condensed = loadedWeights('Barlow_Condensed');
  assert.ok(condensed.includes(600), 'the intro headlines are set to 600; without a 600 face they render at 800');
  // ONE rule now. .onbwel-d-head was slide 1's separate headline and was deleted on 2026-08-27 when the five
  // intro screens were merged onto one shared layout — a second headline scale was part of what put slide 1 off
  // the shared grid. This test failed on that deletion, which is correct behaviour for a guard pinned to a rule:
  // the rule went away legitimately, so the guard follows it rather than the other way round.
  for (const rule of ['.onbwel-head']) {
    const b = blocks().find((x) => x.selector === rule);
    assert.ok(b, `${rule} not found`);
    assert.match(b.body, /font-weight:\s*600/, `${rule} should be SemiBold — Donna's ask, 2026-08-27`);
  }
});

// The 8/21 half of the same lesson, kept so a future weight change to the body face trips here too.
test('the body face carries every weight the body rules ask of it', () => {
  const barlow = loadedWeights('Barlow');
  const used = new Set(
    [...CSS.matchAll(/font-weight:\s*(\d+)/g)].map((m) => Number(m[1])),
  );
  // Weights only legal because the display face carries them.
  const condensed = new Set(loadedWeights('Barlow_Condensed'));
  const unloaded = [...used].filter((w) => !barlow.includes(w) && !condensed.has(w)).sort((a, b) => a - b);
  assert.deepEqual(unloaded, [], `no loaded face carries: ${unloaded.join(', ')}`);
});
