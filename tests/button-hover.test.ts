// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// A FILLED BUTTON MUST NOT LOSE ITS FILL ON HOVER.
//
// This bug has shipped three times: navy-fill-on-hover (fixed 2026-08-15), `background: none` clearing the fill
// (Donna, 2026-08-19), and `background-color: var(--btn-hover-bg)` doing the same thing through a different spec
// rule (found 2026-08-22, live for three days, fourteen buttons including onboarding and the ceremony).
//
// Every one of those was caught by a person looking at the screen, and the third one shipped inside a commit whose
// message said it was verified. So this asserts the SHAPE that keeps producing it, statically, against the
// stylesheet — no browser, no login, runs in the normal suite.
//
// WHAT IT CANNOT DO: prove a colour is pretty, or catch a hover bug that comes from somewhere other than the
// global button rules. It pins the specific class of defect that has now cost three fixes.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

/** Strip comments — every rule below would otherwise match the block explaining why it must not exist. */
const live = css.replace(/\/\*[\s\S]*?\*\//g, '');

test('no global rule sets a background on button:hover', () => {
  // The shape of all three bugs: one rule, matching every button, deciding its hover background. Whatever value
  // it carries — navy, none, or a custom property — it is wrong for most of the buttons it hits, because it
  // cannot know what colour they already are.
  const globalHoverRules = live
    .split('}')
    .map((block) => block.trim())
    .filter((block) => {
      const [selector, body = ''] = block.split('{');
      if (!selector || !body) return false;
      // A GLOBAL rule here means the bare element/`.btn` selector — not `.some-class:hover`, which is exactly
      // the local override this fix wants people to write.
      const isGlobal = /(^|,)\s*(button|\.btn)\s*:hover\s*$/m.test(selector.replace(/\s*,\s*/g, ',\n'));
      return isGlobal && /background(-color)?\s*:/.test(body);
    });

  assert.deepEqual(
    globalHoverRules,
    [],
    'a global button:hover rule is setting a background again — that is the bug that shipped three times:\n'
      + globalHoverRules.join('\n'),
  );
});

test('the --btn-hover-bg custom property is gone and stays gone', () => {
  // Not style policing. `background-color: var(--x)` where --x holds anything invalid resets the property to
  // `transparent` (invalid at computed-value time), and that is not obvious from reading the rule — which is
  // precisely why the previous fix looked correct and was not. The property has no remaining callers; if one
  // reappears, the mechanism is back.
  const declarations = live.match(/--btn-hover-bg\s*:/g) ?? [];
  assert.equal(
    declarations.length,
    0,
    `--btn-hover-bg is declared ${declarations.length}× again; a filled button will go transparent on hover`,
  );
});

test('buttons that want a different hover colour say so in their own rule', () => {
  // The replacement contract, asserted positively so the fix is not just an absence: each of these opted in via
  // the deleted property and now has to carry a local rule. If one is dropped in a later tidy-up, its hover
  // silently reverts to the inherited darkening — which for .rr-cadence-btn (teal on teal) is nearly invisible.
  for (const selector of ['.rr-cadence-btn:hover', '.pb-strip-row:hover', '.rhythm-opt:hover', '.rhythm-opt.sel:hover']) {
    const pattern = new RegExp(
      `${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{]*\\{[^}]*background`,
    );
    assert.ok(pattern.test(live), `${selector} lost its own background rule`);
  }
});

test('one teal for every filled button — the brand teal is never the ground under a label', () => {
  // Jay, 2026-08-22: "the whole point is uniformity throughout the app… future development takes these standards
  // from the start." Two onboarding buttons were filled with --teal (#3b9495) while the other twelve used
  // --teal-text (#2a6d6e) — visibly a different colour side by side, and 3.59:1 against white text where
  // --teal-text is 5.98:1. The token name is the trap: --teal-text READS like the text-only one.
  //
  // Shapes may keep the brand teal — a dot or a progress bar carries no text and has no ratio to clear. The rule
  // is only about a fill that has a label sitting on it.
  const offenders: string[] = [];
  for (const block of live.split('}')) {
    const [selector, body = ''] = block.split('{');
    if (!selector || !body) continue;
    if (!/background(-color)?\s*:\s*var\(--teal[,)]/.test(body)) continue;
    // A label on top means either an explicit colour here, or a class the codebase treats as a button/chip/CTA.
    const carriesText = /color\s*:\s*(#fff|#ffffff|white|var\(--white\))/i.test(body)
      || /\b(btn|button|cta|chip|pill)\b/i.test(selector);
    if (carriesText) offenders.push(selector.trim().split('\n')[0]!);
  }
  assert.deepEqual(
    offenders,
    [],
    'these fill a labelled surface with the brand teal (3.59:1) instead of --teal-text (5.98:1): '
      + offenders.join(' · '),
  );
});

test('no light-ground surface tints itself with a teal wash', () => {
  // Jay, 2026-08-22, option A. The "mint green" Donna flagged is teal-over-white — #E7F2F2 at 12%. There were
  // SEVEN different alphas of it across hover states (0.05 · 0.06 · 0.08 · 0.12 · 0.20) for the same reason the
  // nine hand-picked hovers existed: no standard, so each site picked a number.
  //
  // Outlined buttons firm their border instead. This asserts the absence, because the wash is easy to reach for
  // and reads as harmless at any single call site — it is only obviously wrong at seven.
  //
  // STATIC panels are covered too, as of option 1: a panel that needs its own surface takes --wash and carries
  // the teal on its EDGE. That closed the last three mint surfaces (.ai-disclosure, .pb-gather-cta,
  // .practice-strip), so the rule is simply "no teal wash on a light ground" — hover or not.
  //
  // THE RULE IS ABOUT LIGHT GROUNDS. Mint is what teal does over WHITE. The onboarding rhythm screen is a navy
  // gradient, where the same wash deepens an already-teal selected option and reads as nothing like mint —
  // "firm the border" and "darken" are both close to invisible on that ground. A real exception, named here
  // rather than silently passing, so the next person can see it was decided instead of missed.
  const DARK_GROUND = /^\.(rhythm|onbwel)[-.]/;
  const offenders: string[] = [];
  for (const block of live.split('}')) {
    const [selector, body = ''] = block.split('{');
    if (!selector || !body) continue;
    if (DARK_GROUND.test(selector.trim())) continue;
    if (/background(-color)?\s*:\s*rgba\(\s*59\s*,\s*148\s*,\s*149/.test(body)) {
      offenders.push(selector.trim().split('\n')[0]!);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these use a teal wash on a light ground (mint) instead of --wash + a teal edge: ${offenders.join(' · ')}`,
  );
});

test('no button clears a fill it actually has', () => {
  // The regression that would matter most: someone re-adds a per-button `:hover { background: none }`,
  // reintroducing the disappearing button one class at a time.
  //
  // ONLY FOR CLASSES THAT ARE FILLED AT REST. The first version of this flagged nine selectors and every one was
  // a false positive — ghost and link buttons (.logout-link, .teaser-x, .connect-cta) that are transparent to
  // begin with, where `background: none` on hover clears nothing. A test that cries wolf on its first run gets
  // deleted by the next person, so it asks the question that matters: does this class declare a background
  // COLOUR in its resting rule, and then throw it away on hover?
  const fillsAtRest = new Set<string>();
  for (const block of live.split('}')) {
    const [selector, body = ''] = block.split('{');
    if (!selector || !body || /:hover|:focus|:active/.test(selector)) continue;
    // A colour, not a gradient and not `none` — those are what a ghost button legitimately declares.
    if (!/background(-color)?\s*:\s*(var\(--|#|rgb|hsl)/.test(body)) continue;
    for (const s of selector.split(',')) {
      const cls = s.trim().match(/\.[a-z0-9-]+/gi)?.join('');
      if (cls) fillsAtRest.add(cls);
    }
  }

  const offenders: string[] = [];
  for (const block of live.split('}')) {
    const [selector, body = ''] = block.split('{');
    if (!selector || !body || !/:hover/.test(selector)) continue;
    if (!/background(-color)?\s*:\s*(none|transparent)\s*[;]?\s*$/m.test(body.trim())) continue;
    for (const s of selector.split(',')) {
      if (!/:hover/.test(s)) continue;
      const cls = s.trim().replace(/:hover.*$/, '').match(/\.[a-z0-9-]+/gi)?.join('');
      if (cls && fillsAtRest.has(cls)) offenders.push(s.trim());
    }
  }
  assert.deepEqual(offenders, [], `these clear a fill they actually have: ${offenders.join(', ')}`);
});
